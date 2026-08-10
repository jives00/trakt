import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { forceRefreshMovieMetadata } from './movies.service';

// Unreleased titles keep runtime 0 on TMDB for months, so don't re-ask on every dashboard load.
const RETRY_MS = 6 * 60 * 60 * 1000;
const lastAttempt = new Map<number, number>();

export async function backfillMovieRuntimes(userId: number): Promise<void> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT m.tmdb_id AS tmdbId
     FROM watch_history wh
     JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
     WHERE wh.user_id=? AND wh.watched_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       AND (m.runtime_min IS NULL OR m.runtime_min = 0)`,
    [userId],
  );

  const now = Date.now();
  for (const row of rows) {
    const tmdbId = row.tmdbId as number;
    if (now - (lastAttempt.get(tmdbId) ?? 0) < RETRY_MS) continue;
    lastAttempt.set(tmdbId, now);
    try {
      await forceRefreshMovieMetadata(tmdbId);
    } catch {
      // TMDB still has no runtime, or is down — RUNTIME_EXPR falls back to 120 min.
    }
  }
}
