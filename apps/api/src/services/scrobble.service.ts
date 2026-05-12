import { getPool } from '../db';
import type { EmbyWebhookPayload, NowPlayingItem } from '@trakt/types';
import { RowDataPacket } from 'mysql2/promise';
import { getOrFetchMovie } from './movies.service';
import { getOrFetchShow, getOrFetchEpisode } from './shows.service';
import { applyImageOverrides } from './image-overrides.service';

const WATCH_THRESHOLD = { movie: 80, episode: 70 };

export async function handleEmbyScrobble(payload: EmbyWebhookPayload): Promise<void> {
  try {
    const event = payload.Event;

    if (!event || (event !== 'PlaybackProgress' && event !== 'PlaybackStopped')) {
      return;
    }

    const { Item, PlaybackInfo } = payload;
    const progressPct = Math.round((PlaybackInfo.PlaybackPositionTicks / Item.RunTimeTicks) * 100);

    let tmdbId: number | null = null;
    let mediaType: 'movie' | 'episode' | null = null;
    let seasonNumber: number | null = null;
    let episodeNumber: number | null = null;

    if (Item.Type === 'Movie') {
      mediaType = 'movie';
      const tmdbIdStr = Item.ProviderIds?.Tmdb;
      if (tmdbIdStr) {
        tmdbId = parseInt(tmdbIdStr, 10);
      }

      if (!tmdbId) {
        return;
      }
    } else if (Item.Type === 'Episode') {
      mediaType = 'episode';
      const tmdbIdStr = Item.SeriesProviderIds?.Tmdb;
      if (tmdbIdStr) {
        tmdbId = parseInt(tmdbIdStr, 10);
      }

      seasonNumber = Item.ParentIndexNumber || null;
      episodeNumber = Item.IndexNumber || null;

      if (!tmdbId || seasonNumber === null || episodeNumber === null) {
        return;
      }
    }

    if (!tmdbId || !mediaType) {
      return;
    }

    const isExcluded = await isScrobbleExcluded(tmdbId, mediaType, 'emby');
    if (isExcluded) {
      return;
    }

    let mediaIdDb: number;
    if (mediaType === 'movie') {
      const movie = await getOrFetchMovie(tmdbId);
      mediaIdDb = movie.id;
    } else {
      await getOrFetchShow(tmdbId);
      const episode = await getOrFetchEpisode(tmdbId, seasonNumber!, episodeNumber!);
      mediaIdDb = episode.episodeId;
    }

    if (event === 'PlaybackProgress') {
      await updateNowPlaying('emby', mediaType, mediaIdDb, progressPct);
      if (progressPct >= WATCH_THRESHOLD[mediaType]) {
        await upsertWatchHistory('emby', mediaType, mediaIdDb, progressPct, false);
      }
    } else if (event === 'PlaybackStopped') {
      await clearNowPlaying();
      if (progressPct >= WATCH_THRESHOLD[mediaType]) {
        await upsertWatchHistory('emby', mediaType, mediaIdDb, progressPct, true);
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
  integration: 'emby' | 'stremio' | 'kodi'
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
  source: 'emby' | 'stremio' | 'kodi',
  mediaType: 'movie' | 'episode',
  mediaIdDb: number,
  progressPct: number,
  isPlaybackStopped: boolean = false
): Promise<void> {
  const pool = getPool();

  const existingRow = await pool.query(
    `SELECT id FROM watch_history
     WHERE user_id = 1 AND media_type = ? AND media_id = ? AND DATE(watched_at) = CURDATE()`,
    [mediaType, mediaIdDb]
  );

  const completionProgress = Math.min(progressPct, 100);
  const playbackStoppedAtValue = isPlaybackStopped ? new Date() : null;

  if ((existingRow[0] as any[]).length > 0) {
    await pool.query(
      `UPDATE watch_history
       SET progress_pct = ?, watched_at = NOW(), source = ?, completion_progress = ?, playback_stopped_at = ?
       WHERE user_id = 1 AND media_type = ? AND media_id = ? AND DATE(watched_at) = CURDATE()`,
      [progressPct, source, completionProgress, playbackStoppedAtValue, mediaType, mediaIdDb]
    );
  } else {
    await pool.query(
      `INSERT INTO watch_history (user_id, media_type, media_id, progress_pct, source, watched_at, completion_progress, playback_stopped_at)
       VALUES (1, ?, ?, ?, ?, NOW(), ?, ?)`,
      [mediaType, mediaIdDb, progressPct, source, completionProgress, playbackStoppedAtValue]
    );
  }
}

export async function updateNowPlaying(
  source: 'emby' | 'stremio' | 'kodi',
  mediaType: 'movie' | 'episode',
  mediaIdDb: number,
  progressPct: number
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO now_playing (user_id, media_type, media_id, progress_pct, source)
     VALUES (1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       media_type   = VALUES(media_type),
       media_id     = VALUES(media_id),
       progress_pct = VALUES(progress_pct),
       source       = VALUES(source)`,
    [mediaType, mediaIdDb, progressPct, source]
  );
}

export async function clearNowPlaying(): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM now_playing WHERE user_id = 1`);
}

export async function getNowPlaying(): Promise<NowPlayingItem | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       np.media_type      AS mediaType,
       np.progress_pct    AS progressPct,
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
     WHERE np.user_id = 1
       AND np.updated_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
  );

  if (!(rows as any[]).length) return null;
  const r = (rows as any[])[0];
  const item: NowPlayingItem = {
    mediaType:       r.mediaType,
    progressPct:     r.progressPct,
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
