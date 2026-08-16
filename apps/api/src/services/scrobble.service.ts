import { getPool } from '../db';
import type { EmbyWebhookPayload, NowPlayingItem } from '@trakt/types';
import { RowDataPacket } from 'mysql2/promise';
import { getOrFetchMovie } from './movies.service';
import { getOrFetchShow, getOrFetchEpisode } from './shows.service';
import { checkMovieWatchlistCompletion, checkShowWatchlistCompletion } from './user-media.service';
import { applyImageOverrides } from './image-overrides.service';
import { get as tmdbGet } from './tmdb.client';

export const DEFAULT_USER_ID = 1;

export async function getWatchThreshold(userId: number): Promise<{ movie: number; episode: number }> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT watch_threshold_movie, watch_threshold_episode FROM users WHERE id = ?',
    [userId]
  );
  if (rows.length === 0) return { movie: 90, episode: 90 };
  return {
    movie: rows[0].watch_threshold_movie as number,
    episode: rows[0].watch_threshold_episode as number,
  };
}

async function resolveShowTmdbIdFromTvdbEpisode(tvdbEpisodeId: string): Promise<number | null> {
  try {
    const data = await tmdbGet<any>(`/find/${tvdbEpisodeId}?external_source=tvdb_id`);
    return data.tv_episode_results?.[0]?.show_id ?? null;
  } catch (err) {
    console.error('Failed to resolve TMDB show ID from TVDB episode ID:', err);
    return null;
  }
}

export async function handleEmbyScrobble(payload: EmbyWebhookPayload): Promise<void> {
  try {
    const event = payload.Event;

    if (!event || (event !== 'playback.start' && event !== 'playback.stop')) {
      return;
    }

    const { Item, PlaybackInfo } = payload;
    const progressPct = Item.RunTimeTicks > 0
      ? Math.min(100, Math.round((PlaybackInfo.PositionTicks / Item.RunTimeTicks) * 100))
      : 0;

    let tmdbId: number | null = null;
    let mediaType: 'movie' | 'episode' | null = null;
    let seasonNumber: number | null = null;
    let episodeNumber: number | null = null;

    if (Item.Type === 'Movie') {
      mediaType = 'movie';
      const tmdbIdStr = Item.ProviderIds?.Tmdb;
      if (tmdbIdStr) tmdbId = parseInt(tmdbIdStr, 10);
      if (!tmdbId) return;
    } else if (Item.Type === 'Episode') {
      mediaType = 'episode';
      seasonNumber = Item.ParentIndexNumber ?? null;
      episodeNumber = Item.IndexNumber ?? null;
      if (seasonNumber === null || episodeNumber === null) return;

      const tmdbIdStr = Item.SeriesProviderIds?.Tmdb;
      if (tmdbIdStr) tmdbId = parseInt(tmdbIdStr, 10);

      if (!tmdbId) {
        const tvdbEpisodeId = Item.ProviderIds?.Tvdb;
        if (tvdbEpisodeId) tmdbId = await resolveShowTmdbIdFromTvdbEpisode(tvdbEpisodeId);
      }

      if (!tmdbId) return;
    }

    if (!tmdbId || !mediaType) return;

    let mediaIdDb: number;
    let showDbId: number | null = null;
    if (mediaType === 'movie') {
      const movie = await getOrFetchMovie(tmdbId);
      mediaIdDb = movie.id;
    } else {
      const show = await getOrFetchShow(tmdbId);
      showDbId = show.id;
      const episode = await getOrFetchEpisode(tmdbId, seasonNumber!, episodeNumber!);
      mediaIdDb = episode.episodeId;
    }

    const isExcluded = await isScrobbleExcluded(tmdbId, mediaType, 'emby');

    const threshold = await getWatchThreshold(DEFAULT_USER_ID);
    if (event === 'playback.start') {
      await updateNowPlaying(DEFAULT_USER_ID, 'emby', mediaType, mediaIdDb, progressPct);
    } else if (event === 'playback.stop') {
      await clearNowPlaying(DEFAULT_USER_ID);
      if (!isExcluded && progressPct >= threshold[mediaType]) {
        await upsertWatchHistory(DEFAULT_USER_ID, 'emby', mediaType, mediaIdDb, progressPct, true);
        if (mediaType === 'movie') {
          void checkMovieWatchlistCompletion(DEFAULT_USER_ID, mediaIdDb)
            .catch(err => console.error('Watchlist movie completion check failed:', err));
        } else if (showDbId !== null) {
          void checkShowWatchlistCompletion(DEFAULT_USER_ID, showDbId)
            .catch(err => console.error('Watchlist show completion check failed:', err));
        }
      }
    }
  } catch (err) {
    console.error('Error in handleEmbyScrobble:', err);
    throw err;
  }
}

export async function isScrobbleExcluded(
  tmdbId: number,
  mediaType: 'movie' | 'episode',
  integration: 'emby' | 'kodi' | 'nuvio'
): Promise<boolean> {
  const pool = getPool();
  const exclusionMediaType = mediaType === 'episode' ? 'show' : 'movie';
  const [rows] = await pool.query(
    `SELECT 1 FROM scrobble_exclusions
     WHERE tmdb_id = ? AND media_type = ? AND integration = ?`,
    [tmdbId, exclusionMediaType, integration]
  );
  return (rows as any[]).length > 0;
}

export async function upsertWatchHistory(
  userId: number,
  source: 'emby' | 'kodi' | 'nuvio',
  mediaType: 'movie' | 'episode',
  mediaIdDb: number,
  progressPct: number,
  isPlaybackStopped: boolean = false
): Promise<void> {
  const pool = getPool();

  const existingRow = await pool.query(
    `SELECT id FROM watch_history
     WHERE user_id = ? AND media_type = ? AND media_id = ?
       AND watched_at >= CURDATE() AND watched_at < CURDATE() + INTERVAL 1 DAY`,
    [userId, mediaType, mediaIdDb]
  );

  const completionProgress = Math.min(progressPct, 100);
  const playbackStoppedAtValue = isPlaybackStopped ? new Date() : null;

  if ((existingRow[0] as any[]).length > 0) {
    await pool.query(
      `UPDATE watch_history
       SET progress_pct = ?, watched_at = NOW(), source = ?, completion_progress = ?, playback_stopped_at = ?
       WHERE user_id = ? AND media_type = ? AND media_id = ?
         AND watched_at >= CURDATE() AND watched_at < CURDATE() + INTERVAL 1 DAY`,
      [progressPct, source, completionProgress, playbackStoppedAtValue, userId, mediaType, mediaIdDb]
    );
    console.log(`✅ Scrobble updated — ${source} ${mediaType} id=${mediaIdDb} at ${progressPct}%`);
  } else {
    await pool.query(
      `INSERT INTO watch_history (user_id, media_type, media_id, progress_pct, source, watched_at, completion_progress, playback_stopped_at)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)`,
      [userId, mediaType, mediaIdDb, progressPct, source, completionProgress, playbackStoppedAtValue]
    );
    console.log(`✅ Scrobble recorded — ${source} ${mediaType} id=${mediaIdDb} at ${progressPct}%`);
  }
}

const FALLBACK_RUNTIME_MIN = { movie: 120, episode: 45 } as const;

export async function updateNowPlaying(
  userId: number,
  source: 'emby' | 'kodi' | 'nuvio',
  mediaType: 'movie' | 'episode',
  mediaIdDb: number,
  progressPct: number,
  paused: boolean = false
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO now_playing (user_id, media_type, media_id, progress_pct, source, paused)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       media_type   = VALUES(media_type),
       media_id     = VALUES(media_id),
       progress_pct = VALUES(progress_pct),
       source       = VALUES(source),
       paused       = VALUES(paused),
       updated_at   = NOW()`,
    [userId, mediaType, mediaIdDb, progressPct, source, paused ? 1 : 0]
  );
}

export async function clearNowPlaying(userId: number): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM now_playing WHERE user_id = ?`, [userId]);
}

export async function getNowPlaying(userId: number): Promise<NowPlayingItem | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       np.media_type      AS mediaType,
       np.progress_pct    AS progressPct,
       np.source          AS source,
       np.paused          AS paused,
       np.updated_at      AS updatedAt,
       m.tmdb_id          AS movieTmdbId,
       m.title            AS movieTitle,
       m.tagline,
       m.backdrop_path    AS backdropPath,
       m.runtime_min      AS runtimeMin,
       s.tmdb_id          AS showTmdbId,
       s.title            AS showTitle,
       seas.season_number AS seasonNumber,
       e.episode_number   AS episodeNumber,
       e.title            AS episodeTitle,
       e.still_path       AS stillPath,
       s.backdrop_path    AS showBackdropPath,
       COALESCE(e.runtime_min, s.runtime_min) AS showRuntimeMin
     FROM now_playing np
     LEFT JOIN movies m     ON np.media_type = 'movie'   AND np.media_id = m.id
     LEFT JOIN episodes e   ON np.media_type = 'episode' AND np.media_id = e.id
     LEFT JOIN seasons seas ON seas.id = e.season_id
     LEFT JOIN tv_shows s   ON s.id = e.show_id
     WHERE np.user_id = ?
       AND np.updated_at > DATE_SUB(NOW(), INTERVAL 4 HOUR)`,
    [userId]
  );

  if (!(rows as any[]).length) return null;
  const r = (rows as any[])[0];

  // No source sends periodic updates, so estimate current progress from elapsed time
  // since the last start event and the content runtime.
  // Skip estimation while paused — hold the stored progress steady.
  let progressPct: number = r.progressPct;
  if (!r.paused) {
    // Unreleased or partially-fetched titles can have runtime 0/null; fall back to a
    // typical runtime so the session still ages out instead of lingering forever.
    const stored: number | null = r.runtimeMin ?? r.showRuntimeMin ?? null;
    const runtimeMin = stored && stored > 0 ? stored : FALLBACK_RUNTIME_MIN[r.mediaType as 'movie' | 'episode'];
    const elapsedSec = (Date.now() - new Date(r.updatedAt.replace(' ', 'T') + 'Z').getTime()) / 1000;
    const estimated = r.progressPct + (elapsedSec / (runtimeMin * 60)) * 100;
    if (estimated >= 100) return null;
    progressPct = estimated;
  }

  const item: NowPlayingItem = {
    mediaType:       r.mediaType,
    progressPct:     Math.round(progressPct),
    movieTmdbId:     r.movieTmdbId     ?? null,
    movieTitle:      r.movieTitle      ?? null,
    tagline:         r.tagline         ?? null,
    backdropPath:    r.backdropPath    ?? null,
    runtimeMin:      r.runtimeMin      ?? null,
    showTmdbId:      r.showTmdbId      ?? null,
    showTitle:       r.showTitle       ?? null,
    seasonNumber:    r.seasonNumber    ?? null,
    episodeNumber:   r.episodeNumber   ?? null,
    episodeTitle:    r.episodeTitle    ?? null,
    stillPath:       r.stillPath       ?? null,
    showBackdropPath:r.showBackdropPath ?? null,
    showRuntimeMin:  r.showRuntimeMin  ?? null,
  };

  if (item.mediaType === 'episode' && item.showTmdbId) {
    await applyImageOverrides('show', { tmdbId: item.showTmdbId, posterPath: null, backdropPath: item.showBackdropPath } as any).then(overridden => {
      item.showBackdropPath = overridden.backdropPath;
    });
  } else if (item.mediaType === 'movie' && item.movieTmdbId) {
    await applyImageOverrides('movie', { tmdbId: item.movieTmdbId, posterPath: null, backdropPath: item.backdropPath } as any).then(overridden => {
      item.backdropPath = overridden.backdropPath;
    });
  }

  return item;
}
