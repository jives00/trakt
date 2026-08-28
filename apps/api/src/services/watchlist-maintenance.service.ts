import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { getOrFetchShow, getOrCacheTvdbId } from './shows.service';
import { checkShowWatchlistCompletion } from './user-media.service';

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const START_DELAY_MS = 90_000;

// A show cancelled after you finished it is never re-checked by the watch-event
// path, and its TVDB id is only cached as a side effect of fetching seasons.
// Both leave the watchlist stale until this sweep runs.
async function pruneCompletedShows(): Promise<number> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT l.user_id AS userId, ts.id AS showId, ts.tmdb_id AS tmdbId, ts.title
    FROM list_items li
    JOIN lists l ON l.id = li.list_id AND l.list_type = 'watchlist'
    JOIN tv_shows ts ON ts.id = li.media_id
    WHERE li.media_type = 'show'
  `);

  let pruned = 0;
  for (const row of rows) {
    try {
      await getOrFetchShow(row.tmdbId as number);
      const [[before]] = await pool.query<RowDataPacket[]>(
        `SELECT li.id FROM list_items li JOIN lists l ON l.id = li.list_id
         WHERE l.user_id = ? AND l.list_type = 'watchlist' AND li.media_type = 'show' AND li.media_id = ?`,
        [row.userId, row.showId],
      );
      if (!before) continue;
      await checkShowWatchlistCompletion(row.userId as number, row.showId as number);
      const [[after]] = await pool.query<RowDataPacket[]>('SELECT id FROM list_items WHERE id = ?', [before.id]);
      if (!after) {
        pruned++;
        console.log(`[watchlist-maintenance] pruned "${row.title}" (ended and fully watched)`);
      }
    } catch (err) {
      console.error(`[watchlist-maintenance] prune failed for show ${row.tmdbId}:`, err);
    }
  }
  return pruned;
}

// Shows with no cached TVDB id are silently dropped from the Sonarr export feed.
async function backfillTvdbIds(): Promise<number> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT DISTINCT ts.id AS showId, ts.tmdb_id AS tmdbId, ts.title
    FROM list_items li
    JOIN tv_shows ts ON ts.id = li.media_id
    WHERE li.media_type = 'show'
      AND NOT EXISTS (
        SELECT 1 FROM external_ids x
        WHERE x.media_type = 'show' AND x.media_id = ts.id AND x.source = 'tvdb'
      )
  `);

  let filled = 0;
  for (const row of rows) {
    try {
      const tvdbId = await getOrCacheTvdbId(row.showId as number, row.tmdbId as number);
      if (tvdbId) {
        filled++;
        console.log(`[watchlist-maintenance] cached tvdb=${tvdbId} for "${row.title}"`);
      }
    } catch (err) {
      console.error(`[watchlist-maintenance] tvdb lookup failed for show ${row.tmdbId}:`, err);
    }
  }
  return filled;
}

export async function runWatchlistMaintenance(): Promise<{ pruned: number; tvdbFilled: number }> {
  console.log('[watchlist-maintenance] starting');
  const pruned = await pruneCompletedShows();
  const tvdbFilled = await backfillTvdbIds();
  console.log(`[watchlist-maintenance] done — pruned ${pruned}, tvdb backfilled ${tvdbFilled}`);
  return { pruned, tvdbFilled };
}

export function startWatchlistMaintenance(): void {
  const run = () => void runWatchlistMaintenance().catch(err => console.error('[watchlist-maintenance] error:', err));
  setTimeout(() => { run(); setInterval(run, INTERVAL_MS); }, START_DELAY_MS);
}
