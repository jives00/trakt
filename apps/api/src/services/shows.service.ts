import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { TvShow, ShowDetail, CastMember, ShowEpisodeSummary, EpisodeDetail } from '@trakt/types';
import { getPool } from '../db';
import { fetchShowWithSeasonCount, fetchSeason, fetchTvdbId, fetchShowImdbId, fetchShowCast, fetchSeasonCast, fetchEpisodeGuestStars } from './tmdb-shows.client';
import { fetchSeriesAirTime, fetchSeriesAirInfo } from './tvdb.client';
import { applyImageOverrides } from './image-overrides.service';
import { fetchImdbRating } from './omdb.client';

interface ShowRow extends RowDataPacket {
  id: number; tmdb_id: number; title: string; year: number;
  overview: string; poster_path: string | null; backdrop_path: string | null;
  status: string | null; network: string | null; genres: string;
  season_count: number;
  first_air_date: string | null; origin_country: string | null;
  original_language: string | null; runtime_min: number | null;
  air_time: string | null; airs_day: string | null;
  rt_critic_score: number | null; rt_audience_score: number | null;
  tmdb_rating: number | null;
}

interface SeasonRow extends RowDataPacket {
  id: number; show_id: number; season_number: number;
  episode_count: number; poster_path: string | null; air_date: string | null;
  fetched_at: Date | null;
}

function seasonTtlDays(airDate: string | null): number {
  if (!airDate) return 1;
  const msSinceAir = Date.now() - new Date(airDate).getTime();
  return msSinceAir < 60 * 86400000 ? 1 : 7;
}

function isSeasonStale(fetchedAt: Date | null, airDate: string | null): boolean {
  if (!fetchedAt) return true;
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs >= seasonTtlDays(airDate) * 86400000;
}

interface EpisodeRow extends RowDataPacket {
  id: number; season_id: number; show_id: number;
  episode_number: number; title: string | null; overview: string | null;
  air_date: string | null; still_path: string | null; runtime_min: number | null;
}

async function getShowImdbId(showInternalId: number): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.query<ExternalIdRow[]>(
    `SELECT external_id FROM external_ids WHERE media_type = 'show' AND media_id = ? AND source = 'imdb'`,
    [showInternalId],
  );
  return rows.length > 0 ? rows[0].external_id : null;
}

function rowToShow(row: ShowRow, seasonCount?: number, imdbId?: string | null): ShowDetail & { id: number } {
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
    firstAirDate: row.first_air_date ? String(row.first_air_date).slice(0, 10) : null,
    originCountry: row.origin_country,
    originalLanguage: row.original_language,
    runtimeMin: row.runtime_min,
    airTime: row.air_time,
    airsDay: row.airs_day,
    rtCriticScore: row.rt_critic_score,
    rtAudienceScore: row.rt_audience_score,
    imdbId: imdbId ?? null,
    tmdbRating: row.tmdb_rating,
  };
}

export async function getOrFetchShow(tmdbId: number) {
  const pool = getPool();
  const [rows] = await pool.query<ShowRow[]>(
    'SELECT * FROM tv_shows WHERE tmdb_id = ?', [tmdbId],
  );

  if (rows.length > 0) {
    const row = rows[0];
    const imdbId = await getShowImdbId(row.id);
    // Backfill metadata for shows cached before migration 007
    if (row.original_language === null) {
      const { show: fresh, seasonCount: freshCount } = await fetchShowWithSeasonCount(tmdbId);
      const sc = row.season_count > 0 ? row.season_count : freshCount;
      await pool.query(
        `UPDATE tv_shows SET first_air_date = ?, origin_country = ?, original_language = ?, runtime_min = ?, season_count = ? WHERE id = ?`,
        [fresh.firstAirDate, fresh.originCountry, fresh.originalLanguage, fresh.runtimeMin, sc, row.id],
      );
      if (process.env.NODE_ENV !== 'test') {
        backfillShowImdbRating(row.id, tmdbId).catch(() => {});
        backfillShowTmdbRating(row.id, tmdbId).catch(() => {});
      }
      return applyImageOverrides('show', rowToShow({ ...row, first_air_date: fresh.firstAirDate, origin_country: fresh.originCountry, original_language: fresh.originalLanguage, runtime_min: fresh.runtimeMin }, sc, imdbId));
    }
    if (row.season_count === 0) {
      const { seasonCount } = await fetchShowWithSeasonCount(tmdbId);
      await pool.query('UPDATE tv_shows SET season_count = ? WHERE id = ?', [seasonCount, row.id]);
      if (process.env.NODE_ENV !== 'test') {
        backfillShowImdbRating(row.id, tmdbId).catch(() => {});
        backfillShowTmdbRating(row.id, tmdbId).catch(() => {});
      }
      return applyImageOverrides('show', rowToShow(row, seasonCount, imdbId));
    }
    const show = rowToShow(row, row.season_count, imdbId);
    if (show.runtimeMin === null) {
      const [rtRows] = await pool.query<RowDataPacket[]>(
        'SELECT runtime_min FROM episodes WHERE show_id = ? AND runtime_min IS NOT NULL GROUP BY runtime_min ORDER BY COUNT(*) DESC LIMIT 1',
        [row.id],
      );
      if (rtRows.length > 0) {
        show.runtimeMin = (rtRows[0] as any).runtime_min;
        await pool.query('UPDATE tv_shows SET runtime_min = ? WHERE id = ?', [show.runtimeMin, row.id]);
      }
    }
    if (process.env.NODE_ENV !== 'test') {
      backfillShowImdbRating(row.id, tmdbId).catch(() => {});
      backfillShowTmdbRating(row.id, tmdbId).catch(() => {});
    }
    return applyImageOverrides('show', show);
  }

  const { show, seasonCount } = await fetchShowWithSeasonCount(tmdbId);
  const tmdbRating = show.tmdbRating ?? null;

  await pool.query(
    `INSERT INTO tv_shows (tmdb_id, title, year, overview, poster_path, backdrop_path, status, network, genres, season_count, first_air_date, origin_country, original_language, runtime_min, tmdb_rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE tmdb_id = tmdb_id, tmdb_rating = VALUES(tmdb_rating)`,
    [tmdbId, show.title, show.year || null, show.overview, show.posterPath,
     show.backdropPath, show.status, show.network, JSON.stringify(show.genres), seasonCount,
     show.firstAirDate, show.originCountry, show.originalLanguage, show.runtimeMin, tmdbRating],
  );
  const [inserted] = await pool.query<ShowRow[]>('SELECT * FROM tv_shows WHERE tmdb_id = ?', [tmdbId]);
  const imdbId = await getShowImdbId(inserted[0].id);
  const result = rowToShow(inserted[0], seasonCount, imdbId);
  if (process.env.NODE_ENV !== 'test') {
    backfillShowImdbRating(result.id, tmdbId).catch(() => {});
  }
  return applyImageOverrides('show', result);
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

async function getOrCacheShowImdbId(showInternalId: number, showTmdbId: number): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.query<ExternalIdRow[]>(
    `SELECT external_id FROM external_ids WHERE media_type = 'show' AND media_id = ? AND source = 'imdb'`,
    [showInternalId],
  );
  if (rows.length > 0) return rows[0].external_id;

  const imdbId = await fetchShowImdbId(showTmdbId);
  if (!imdbId) return null;

  await pool.query(
    `INSERT IGNORE INTO external_ids (media_type, media_id, source, external_id) VALUES ('show', ?, 'imdb', ?)`,
    [showInternalId, imdbId],
  );
  return imdbId;
}

async function backfillShowImdbRating(showInternalId: number, showTmdbId: number): Promise<void> {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT rt_critic_score FROM tv_shows WHERE id = ? AND rt_critic_score IS NULL',
      [showInternalId],
    );
    if (rows.length === 0) {
      return;
    }

    console.log(`[IMDb] Backfilling IMDb rating for show ${showTmdbId} (id: ${showInternalId})`);
    const imdbId = await getOrCacheShowImdbId(showInternalId, showTmdbId);
    if (!imdbId) {
      console.log(`[IMDb] No IMDb ID found for show ${showTmdbId}`);
      return;
    }

    console.log(`[IMDb] Got IMDb ID ${imdbId}, fetching rating...`);
    const rating = await fetchImdbRating(imdbId);
    if (rating === null) {
      console.log(`[IMDb] No rating found for IMDb ${imdbId}`);
      return;
    }

    console.log(`[IMDb] Updating show ${showTmdbId} with rating: ${rating}`);
    await pool.query(
      'UPDATE tv_shows SET rt_critic_score = ? WHERE id = ?',
      [rating, showInternalId],
    );
    console.log(`[IMDb] Updated successfully`);
  } catch (err) {
    console.error(`[IMDb] Error backfilling show ${showTmdbId}:`, err);
  }
}

async function backfillShowTmdbRating(showInternalId: number, showTmdbId: number): Promise<void> {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT tmdb_rating FROM tv_shows WHERE id = ? AND tmdb_rating IS NULL',
      [showInternalId],
    );
    if (rows.length === 0) {
      return;
    }

    console.log(`[TMDB] Backfilling TMDB rating for show ${showTmdbId} (id: ${showInternalId})`);
    const { show } = await fetchShowWithSeasonCount(showTmdbId);
    if (show.tmdbRating === null) {
      console.log(`[TMDB] No rating found for show ${showTmdbId}`);
      return;
    }

    console.log(`[TMDB] Updating show ${showTmdbId} with rating: ${show.tmdbRating}`);
    await pool.query(
      'UPDATE tv_shows SET tmdb_rating = ? WHERE id = ?',
      [show.tmdbRating, showInternalId],
    );
    console.log(`[TMDB] Updated successfully`);
  } catch (err) {
    console.error(`[TMDB] Error backfilling show ${showTmdbId}:`, err);
  }
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
  const existing = seasonRows[0] ?? null;

  let seasonId: number;

  if (!existing || isSeasonStale(existing.fetched_at, existing.air_date)) {
    const tmdbSeason = await fetchSeason(showTmdbId, seasonNumber);

    if (!existing) {
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO seasons (show_id, season_number, episode_count, poster_path, air_date, season_type, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [show.id, seasonNumber, tmdbSeason.episodeCount, tmdbSeason.posterPath, tmdbSeason.airDate, tmdbSeason.seasonType ?? 'regular'],
      );
      seasonId = r.insertId;
    } else {
      seasonId = existing.id;
      await pool.query(
        `UPDATE seasons SET episode_count = ?, poster_path = ?, air_date = ?, season_type = ?, fetched_at = NOW() WHERE id = ?`,
        [tmdbSeason.episodeCount, tmdbSeason.posterPath, tmdbSeason.airDate, tmdbSeason.seasonType ?? 'regular', seasonId],
      );
    }

    if (tmdbSeason.episodes) {
      let seriesAirTime: string | null = null;
      if (!existing) {
        try {
          const tvdbId = await getOrCacheTvdbId(show.id, showTmdbId);
          if (tvdbId) {
            const { airTime, airsDay } = await fetchSeriesAirInfo(tvdbId);
            seriesAirTime = airTime;
            await pool.query(
              'UPDATE tv_shows SET air_time = COALESCE(air_time, ?), airs_day = COALESCE(airs_day, ?) WHERE id = ?',
              [airTime, airsDay, show.id],
            );
          }
        } catch {
          // TVDB failure is non-blocking — episodes are still inserted without air time
        }
      }

      for (const ep of tmdbSeason.episodes) {
        await pool.query(
          `INSERT INTO episodes (show_id, season_id, episode_number, title, overview, still_path, air_date, runtime_min, air_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title = VALUES(title), overview = VALUES(overview),
             still_path = VALUES(still_path), air_date = VALUES(air_date), runtime_min = VALUES(runtime_min)`,
          [show.id, seasonId, ep.episodeNumber, ep.title, ep.overview, ep.stillPath, ep.airDate, ep.runtimeMin, ep.airTime ?? seriesAirTime],
        );
      }
    }
  } else {
    seasonId = existing.id;
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

export async function getShowSeasonList(showTmdbId: number) {
  const pool = getPool();
  const [showRows] = await pool.query<ShowRow[]>('SELECT id FROM tv_shows WHERE tmdb_id = ?', [showTmdbId]);
  const show = showRows[0];
  if (!show) throw new Error(`Show ${showTmdbId} not in DB`);
  const [rows] = await pool.query<SeasonRow[]>(
    'SELECT season_number, episode_count, poster_path FROM seasons WHERE show_id = ? ORDER BY season_number',
    [show.id],
  );
  return rows.map((r) => ({ seasonNumber: r.season_number, episodeCount: r.episode_count, posterPath: r.poster_path }));
}

export async function prefetchAllSeasons(showTmdbId: number): Promise<void> {
  const { seasonCount } = await fetchShowWithSeasonCount(showTmdbId);
  for (let n = 1; n <= seasonCount; n++) {
    await getOrFetchSeason(showTmdbId, n).catch(() => {});
  }
}

interface PersonRow extends RowDataPacket {
  tmdb_id: number; name: string; profile_path: string | null;
  character: string | null; episode_count: number | null; is_regular: number;
}

interface EpSummaryRow extends RowDataPacket {
  episodeId: number; seasonNumber: number; episodeNumber: number;
  episodeTitle: string | null; airDate: string | null;
  stillPath: string | null; runtimeMin: number | null;
}

function isCastStale(fetchedAt: Date | null): boolean {
  if (!fetchedAt) return true;
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs >= 30 * 86400000;
}

export async function getOrFetchCast(tmdbId: number): Promise<CastMember[]> {
  const pool = getPool();
  const [showRows] = await pool.query<ShowRow[]>('SELECT id, cast_fetched_at FROM tv_shows WHERE tmdb_id = ?', [tmdbId]);
  if (!showRows.length) return [];
  const showRow = showRows[0];
  const showId = showRow.id;
  const castFetchedAt = (showRow as any).cast_fetched_at;

  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS cnt FROM credits WHERE media_type = "show" AND media_id = ?', [showId],
  );
  const hasExisting = Number((existing[0] as any).cnt) > 0;

  if (!hasExisting || isCastStale(castFetchedAt)) {
    const tmdbCast = await fetchShowCast(tmdbId);
    if (hasExisting) {
      await pool.query('DELETE FROM credits WHERE media_type = "show" AND media_id = ?', [showId]);
    }
    for (const m of tmdbCast) {
      await pool.query('INSERT IGNORE INTO people (tmdb_id, name, profile_path) VALUES (?, ?, ?)', [m.tmdbId, m.name, m.profilePath]);
      const [pRows] = await pool.query<RowDataPacket[]>('SELECT id FROM people WHERE tmdb_id = ?', [m.tmdbId]);
      await pool.query(
        'INSERT INTO credits (media_type, media_id, person_id, `character`, `role`, `order`, episode_count, is_regular) VALUES ("show", ?, ?, ?, "cast", 0, ?, ?) ON DUPLICATE KEY UPDATE `character` = VALUES(`character`), episode_count = VALUES(episode_count), is_regular = VALUES(is_regular)',
        [showId, (pRows[0] as any).id, m.character, m.episodeCount, m.isRegular ? 1 : 0],
      );
    }
    await pool.query('UPDATE tv_shows SET cast_fetched_at = NOW() WHERE id = ?', [showId]);
  }

  const [rows] = await pool.query<PersonRow[]>(`
    SELECT DISTINCT p.tmdb_id, p.name, p.profile_path, c.character, c.episode_count, c.is_regular
    FROM credits c JOIN people p ON p.id = c.person_id
    WHERE c.media_type = 'show' AND c.media_id = ? AND c.role = 'cast'
    ORDER BY c.episode_count DESC LIMIT 100
  `, [showId]);

  return rows.map(r => ({
    tmdbId: r.tmdb_id,
    name: r.name,
    profilePath: r.profile_path,
    character: r.character ?? '',
    episodeCount: r.episode_count ?? 0,
    isRegular: Boolean(r.is_regular),
  }));
}

export async function forceRefreshShowCast(tmdbId: number): Promise<CastMember[]> {
  const pool = getPool();
  const [showRows] = await pool.query<ShowRow[]>('SELECT id FROM tv_shows WHERE tmdb_id = ?', [tmdbId]);
  if (!showRows.length) return [];
  const showId = showRows[0].id;

  await pool.query('DELETE FROM credits WHERE media_type = "show" AND media_id = ?', [showId]);
  await pool.query('UPDATE tv_shows SET cast_fetched_at = NULL WHERE id = ?', [showId]);

  return getOrFetchCast(tmdbId);
}

export async function getShowUpNext(userId: number, tmdbId: number): Promise<ShowEpisodeSummary | null> {
  const pool = getPool();
  const [showRows] = await pool.query<RowDataPacket[]>('SELECT id FROM tv_shows WHERE tmdb_id = ?', [tmdbId]);
  if (!showRows.length) return null;
  const showId = (showRows[0] as any).id;

  const [lastRows] = await pool.query<RowDataPacket[]>(`
    SELECT seas.season_number, e.episode_number FROM watch_history wh
    JOIN episodes e ON e.id = wh.media_id
    JOIN seasons seas ON seas.id = e.season_id AND seas.show_id = ?
    WHERE wh.media_type = 'episode' AND wh.user_id = ?
    ORDER BY wh.watched_at DESC LIMIT 1
  `, [showId, userId]);

  const lastSeason: number = (lastRows[0] as any)?.season_number ?? 0;
  const lastEp: number = (lastRows[0] as any)?.episode_number ?? 0;

  const [rows] = await pool.query<EpSummaryRow[]>(`
    SELECT e.id AS episodeId, seas.season_number AS seasonNumber, e.episode_number AS episodeNumber,
           e.title AS episodeTitle, e.air_date AS airDate, e.still_path AS stillPath, e.runtime_min AS runtimeMin
    FROM episodes e
    JOIN seasons seas ON seas.id = e.season_id AND seas.show_id = ?
    LEFT JOIN watch_history wh ON wh.media_type = 'episode' AND wh.media_id = e.id AND wh.user_id = ?
    WHERE wh.id IS NULL AND e.air_date <= CURDATE()
      AND (seas.season_number > ? OR (seas.season_number = ? AND e.episode_number > ?))
    ORDER BY seas.season_number, e.episode_number LIMIT 1
  `, [showId, userId, lastSeason, lastSeason, lastEp]);

  if (!rows.length) return null;
  const r = rows[0];
  return {
    episodeId: r.episodeId, seasonNumber: r.seasonNumber, episodeNumber: r.episodeNumber,
    title: r.episodeTitle, airDate: r.airDate ? String(r.airDate).slice(0, 10) : null,
    stillPath: r.stillPath, runtimeMin: r.runtimeMin,
  };
}

export async function getShowRecentEpisodes(tmdbId: number, limit = 2): Promise<ShowEpisodeSummary[]> {
  const pool = getPool();

  interface StaleCheckRow extends RowDataPacket { seasonNumber: number; fetchedAt: Date | null; airDate: string | null }
  const [staleCheck] = await pool.query<StaleCheckRow[]>(`
    SELECT seas.season_number AS seasonNumber, seas.fetched_at AS fetchedAt, seas.air_date AS airDate
    FROM episodes e
    JOIN seasons seas ON seas.id = e.season_id
    JOIN tv_shows s ON s.id = seas.show_id AND s.tmdb_id = ?
    WHERE e.air_date <= CURDATE()
    ORDER BY e.air_date DESC, seas.season_number DESC, e.episode_number DESC LIMIT 1
  `, [tmdbId]);
  if (staleCheck.length > 0 && isSeasonStale(staleCheck[0].fetchedAt, staleCheck[0].airDate)) {
    await getOrFetchSeason(tmdbId, staleCheck[0].seasonNumber);
  }

  const [rows] = await pool.query<EpSummaryRow[]>(`
    SELECT e.id AS episodeId, seas.season_number AS seasonNumber, e.episode_number AS episodeNumber,
           e.title AS episodeTitle, e.air_date AS airDate, e.still_path AS stillPath, e.runtime_min AS runtimeMin
    FROM episodes e
    JOIN seasons seas ON seas.id = e.season_id
    JOIN tv_shows s ON s.id = seas.show_id AND s.tmdb_id = ?
    WHERE e.air_date <= CURDATE()
    ORDER BY e.air_date DESC, seas.season_number DESC, e.episode_number DESC LIMIT ?
  `, [tmdbId, limit]);

  return rows.map(r => ({
    episodeId: r.episodeId, seasonNumber: r.seasonNumber, episodeNumber: r.episodeNumber,
    title: r.episodeTitle, airDate: r.airDate ? String(r.airDate).slice(0, 10) : null,
    stillPath: r.stillPath, runtimeMin: r.runtimeMin,
  }));
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

export async function getEpisodeDetail(tmdbId: number, seasonNumber: number, episodeNumber: number) {
  const pool = getPool();
  const [showRows] = await pool.query<ShowRow[]>('SELECT id, tmdb_id, title FROM tv_shows WHERE tmdb_id = ?', [tmdbId]);
  if (!showRows.length) throw new Error(`Show ${tmdbId} not in DB`);
  const show = showRows[0];

  const [episodeRows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.episode_number, e.title, e.overview, e.air_date, e.still_path, e.runtime_min
     FROM episodes e
     JOIN seasons s ON s.id = e.season_id AND s.show_id = ? AND s.season_number = ?
     WHERE e.episode_number = ?`,
    [show.id, seasonNumber, episodeNumber],
  );
  if (!episodeRows.length) throw new Error(`Episode S${seasonNumber}E${episodeNumber} not found`);

  const ep = episodeRows[0] as any;
  const episode: EpisodeDetail = {
    id: ep.id,
    episodeNumber: ep.episode_number,
    title: ep.title,
    overview: ep.overview,
    airDate: ep.air_date ? String(ep.air_date).slice(0, 10) : null,
    stillPath: ep.still_path,
    runtimeMin: ep.runtime_min,
    showTmdbId: show.tmdb_id,
    showTitle: show.title,
    seasonNumber,
  };
  return { episode, episodeId: ep.id, showId: show.id };
}

export async function getEpisodeCast(tmdbId: number, seasonNumber: number, episodeNumber: number): Promise<CastMember[]> {
  try {
    const [seasonCast, guests] = await Promise.all([
      fetchSeasonCast(tmdbId, seasonNumber),
      fetchEpisodeGuestStars(tmdbId, seasonNumber, episodeNumber),
    ]);

    const guestIds = new Set(guests.map(g => g.tmdbId));
    const regulars = seasonCast.filter(m => !guestIds.has(m.tmdbId));

    return [...regulars, ...guests];
  } catch (err) {
    console.error('Error fetching episode cast:', err);
    return [];
  }
}

export async function forceRefreshShowMetadata(tmdbId: number): Promise<ShowDetail & { id: number }> {
  const pool = getPool();
  await pool.query('DELETE FROM tv_shows WHERE tmdb_id = ?', [tmdbId]);
  return getOrFetchShow(tmdbId);
}

export async function forceRefreshShowSeasons(tmdbId: number): Promise<void> {
  const pool = getPool();
  const show = await getOrFetchShow(tmdbId);

  await pool.query('UPDATE seasons SET fetched_at = NULL WHERE show_id = ?', [show.id]);
  await prefetchAllSeasons(tmdbId);
}

export async function forceRefreshEpisode(tmdbId: number, seasonNumber: number): Promise<{ seasonId: number; showId: number; episodes: any[] }> {
  const pool = getPool();
  const show = await getOrFetchShow(tmdbId);

  await pool.query('UPDATE seasons SET fetched_at = NULL WHERE show_id = ? AND season_number = ?', [show.id, seasonNumber]);
  return getOrFetchSeason(tmdbId, seasonNumber);
}
