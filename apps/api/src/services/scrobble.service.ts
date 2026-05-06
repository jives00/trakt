import { getPool } from '../db';
import type { EmbyWebhookPayload } from '@trakt/types';

const WATCH_THRESHOLD = { movie: 80, episode: 70 };

export async function handleEmbyScrobble(payload: EmbyWebhookPayload): Promise<void> {
  try {
    const event = payload.Event;

    if (!event || (event !== 'PlaybackProgress' && event !== 'PlaybackStopped')) {
      return;
    }

    const { Item, PlaybackInfo } = payload;
    const progressPct = Math.round((PlaybackInfo.PlaybackPositionTicks / Item.RunTimeTicks) * 100);

    let mediaId: number | null = null;
    let mediaType: 'movie' | 'show' | null = null;

    if (Item.Type === 'Movie') {
      mediaType = 'movie';
      const tmdbIdStr = Item.ProviderIds?.Tmdb;
      if (tmdbIdStr) {
        mediaId = parseInt(tmdbIdStr, 10);
      }

      if (!mediaId) {
        return;
      }

      if (progressPct < WATCH_THRESHOLD.movie) {
        return;
      }
    } else if (Item.Type === 'Episode') {
      mediaType = 'episode';
      const tmdbIdStr = Item.SeriesProviderIds?.Tmdb;
      if (tmdbIdStr) {
        mediaId = parseInt(tmdbIdStr, 10);
      }

      if (!mediaId) {
        return;
      }

      if (progressPct < WATCH_THRESHOLD.episode) {
        return;
      }
    }

    if (!mediaId || !mediaType) {
      return;
    }

    const pool = getPool();

    const isExcluded = await isScrobbleExcluded(mediaId, mediaType, 'emby');
    if (isExcluded) {
      return;
    }

    const existingRow = await pool.query(
      `SELECT id FROM watch_history
       WHERE user_id = 1 AND media_type = ? AND media_id = ? AND DATE(watched_at) = CURDATE()`,
      [mediaType, mediaId]
    );

    if ((existingRow[0] as any[]).length > 0) {
      await pool.query(
        `UPDATE watch_history
         SET progress_pct = ?, watched_at = NOW(), source = 'emby'
         WHERE user_id = 1 AND media_type = ? AND media_id = ? AND DATE(watched_at) = CURDATE()`,
        [progressPct, mediaType, mediaId]
      );
    } else {
      await pool.query(
        `INSERT INTO watch_history (user_id, media_type, media_id, progress_pct, source, watched_at)
         VALUES (1, ?, ?, ?, 'emby', NOW())`,
        [mediaType, mediaId, progressPct]
      );
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
