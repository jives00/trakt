import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { TvShow } from '@trakt/types';
import { getPool } from '../db';
import { fetchShowWithSeasonCount, fetchSeason, fetchTvdbId } from './tmdb.client';
import { fetchSeriesAirTime } from './tvdb.client';

interface ShowRow extends RowDataPacket {
  id: number; tmdb_id: number; title: string; year: number;
  overview: string; poster_path: string | null; backdrop_path: string | null;
  status: string | null; network: string | null; genres: string;
  season_count: number;
}

interface SeasonRow extends RowDataPacket {
  id: number; show_id: number; season_number: number;
  episode_count: number; poster_path: string | null; air_date: string | null;
}

interface EpisodeRow extends RowDataPacket {
  id: number; season_id: number; show_id: number;
  episode_number: number; title: string | null; air_date: string | null;
  still_path: string | null; runtime_min: number | null;
}

function rowToShow(row: ShowRow, seasonCount?: number): TvShow & { id: number; seasonCount: number } {
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    title: row.title,
    year: row.year ?? 0,
    overview: row.overview ?? '',
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    status: row.status,
    network: row.network,
    genres: typeof row.genres === 'string' ? JSON.parse(row.genres) : (row.genres ?? []),
    seasonCount: seasonCount ?? 0,
  };
}

export async function getOrFetchShow(tmdbId: number) {
  const pool = getPool();
  const [rows] = await pool.query<ShowRow[]>(
    'SELECT * FROM tv_shows WHERE tmdb_id = ?', [tmdbId],
  );

  if (rows.length > 0) {
    if (rows[0].season_count === 0) {
      const { seasonCount } = await fetchShowWithSeasonCount(tmdbId);
      await pool.query('UPDATE tv_shows SET season_count = ? WHERE id = ?', [seasonCount, rows[0].id]);
      return rowToShow(rows[0], seasonCount);
    }
    return rowToShow(rows[0], rows[0].season_count);
  }

  const { show, seasonCount } = await fetchShowWithSeasonCount(tmdbId);

  await pool.query(
    `INSERT INTO tv_shows (tmdb_id, title, year, overview, poster_path, backdrop_path, status, network, genres, season_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE tmdb_id = tmdb_id`,
    [tmdbId, show.title, show.year || null, show.overview, show.posterPath,
     show.backdropPath, show.status, show.network, JSON.stringify(show.genres), seasonCount],
  );
  const [inserted] = await pool.query<ShowRow[]>('SELECT * FROM tv_shows WHERE tmdb_id = ?', [tmdbId]);
  return rowToShow(inserted[0], seasonCount);
}

interface ExternalIdRow extends RowDataPacket { external_id: string }

async function getOrCacheTvdbId(showInternalId: number, showTmdbId: number): Promise<number | null> {
  const pool = getPool();
  const [rows] = await pool.query<ExternalIdRow[]>(
    `SELECT external_id FROM external_ids WHERE media_type = 'show' AND media_id = ? AND source = 'tvdb'`,
    [showInternalId],
  );
  if (rows.length > 0) return Number(rows[0].external_id);

  const tvdbId = await fetchTvdbId(showTmdbId);
  if (!tvdbId) return null;

  await pool.query(
    `INSERT IGNORE INTO external_ids (media_type, media_id, source, external_id) VALUES ('show', ?, 'tvdb', ?)`,
    [showInternalId, String(tvdbId)],
  );
  return tvdbId;
}

export async function getOrFetchSeason(showTmdbId: number, seasonNumber: number) {
  const pool = getPool();
  const [showRows] = await pool.query<ShowRow[]>(
    'SELECT id FROM tv_shows WHERE tmdb_id = ?', [showTmdbId],
  );
  const show = showRows[0];
  if (!show) throw new Error(`Show ${showTmdbId} not in DB — fetch show first`);

  const [seasonRows] = await pool.query<SeasonRow[]>(
    'SELECT * FROM seasons WHERE show_id = ? AND season_number = ?',
    [show.id, seasonNumber],
  );
  let seasonId: number;

  if (seasonRows.length === 0) {
    const tmdbSeason = await fetchSeason(showTmdbId, seasonNumber);
    const [r] = await pool.query<ResultSetHeader>(
      `INSERT INTO seasons (show_id, season_number, episode_count, poster_path, air_date)
       VALUES (?, ?, ?, ?, ?)`,
      [show.id, seasonNumber, tmdbSeason.episodeCount, tmdbSeason.posterPath, tmdbSeason.airDate],
    );
    seasonId = r.insertId;

    if (tmdbSeason.episodes) {
      let seriesAirTime: string | null = null;
      try {
        const tvdbId = await getOrCacheTvdbId(show.id, showTmdbId);
        if (tvdbId) seriesAirTime = await fetchSeriesAirTime(tvdbId);
      } catch {
        // TVDB failure is non-blocking — episodes are still inserted without air time
      }

      for (const ep of tmdbSeason.episodes) {
        await pool.query(
          `INSERT IGNORE INTO episodes (show_id, season_id, episode_number, title, overview, still_path, air_date, runtime_min, air_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [show.id, seasonId, ep.episodeNumber, ep.title, ep.overview, ep.stillPath, ep.airDate, ep.runtimeMin, ep.airTime ?? seriesAirTime],
        );
      }
    }
  } else {
    seasonId = seasonRows[0].id;
  }

  const [episodes] = await pool.query<EpisodeRow[]>(
    'SELECT * FROM episodes WHERE season_id = ? ORDER BY episode_number',
    [seasonId],
  );

  return { seasonId, showId: show.id, episodes };
}

export async function getOrFetchEpisode(showTmdbId: number, seasonNumber: number, episodeNumber: number) {
  const { showId, seasonId, episodes } = await getOrFetchSeason(showTmdbId, seasonNumber);
  const episode = episodes.find((e) => e.episode_number === episodeNumber);
  if (!episode) throw new Error(`Episode S${seasonNumber}E${episodeNumber} not found`);
  return { episodeId: episode.id, showId, seasonId };
}

export async function prefetchAllSeasons(showTmdbId: number): Promise<void> {
  const { seasonCount } = await fetchShowWithSeasonCount(showTmdbId);
  for (let n = 1; n <= seasonCount; n++) {
    await getOrFetchSeason(showTmdbId, n).catch(() => {});
  }
}

interface ShowAirTimeRow extends RowDataPacket { id: number; tmdb_id: number }

export async function backfillAirTimes(): Promise<{ updated: number; failed: number }> {
  const pool = getPool();
  const [shows] = await pool.query<ShowAirTimeRow[]>(
    `SELECT DISTINCT s.id, s.tmdb_id
     FROM tv_shows s
     JOIN episodes e ON e.show_id = s.id
     WHERE e.air_time IS NULL`,
  );

  let updated = 0;
  let failed = 0;

  for (const show of shows) {
    try {
      const tvdbId = await getOrCacheTvdbId(show.id, show.tmdb_id);
      if (!tvdbId) { failed++; continue; }
      const airTime = await fetchSeriesAirTime(tvdbId);
      if (!airTime) { failed++; continue; }
      await pool.query(
        `UPDATE episodes SET air_time = ? WHERE show_id = ? AND air_time IS NULL`,
        [airTime, show.id],
      );
      updated++;
    } catch {
      failed++;
    }
  }

  return { updated, failed };
}
