import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { getOrFetchSeason } from './shows.service';

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const LOOKAHEAD_DAYS = 45;

async function refreshUpcomingEpisodes(): Promise<void> {
  const pool = getPool();
  console.log('[schedule-refresh] starting upcoming episode refresh');

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT DISTINCT s.tmdb_id AS showTmdbId, seas.season_number AS seasonNumber
    FROM tv_shows s
    JOIN seasons seas ON seas.show_id = s.id
    JOIN episodes e ON e.season_id = seas.id
    JOIN list_items li ON li.media_id = s.id AND li.media_type = 'show'
    JOIN lists l ON l.id = li.list_id AND l.list_type IN ('watchlist', 'rewatch')
    LEFT JOIN list_items li_dropped ON li_dropped.media_id = s.id AND li_dropped.media_type = 'show'
      AND li_dropped.list_id IN (SELECT id FROM lists WHERE list_type = 'dropped')
    WHERE li_dropped.id IS NULL
      AND e.air_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
      AND (seas.fetched_at IS NULL OR seas.fetched_at < DATE_SUB(NOW(), INTERVAL 1 DAY))
  `, [LOOKAHEAD_DAYS]);

  console.log(`[schedule-refresh] ${rows.length} stale season(s) with upcoming episodes`);

  for (const row of rows) {
    try {
      await getOrFetchSeason(row.showTmdbId, row.seasonNumber);
    } catch (err) {
      console.error(`[schedule-refresh] failed show ${row.showTmdbId} season ${row.seasonNumber}:`, err);
    }
  }

  console.log('[schedule-refresh] done');
}

export function startScheduleRefresh(): void {
  // Run once shortly after startup, then every 24h
  setTimeout(() => {
    void refreshUpcomingEpisodes().catch(err => console.error('[schedule-refresh] error:', err));
    setInterval(() => {
      void refreshUpcomingEpisodes().catch(err => console.error('[schedule-refresh] error:', err));
    }, INTERVAL_MS);
  }, 60_000); // 60s initial delay to let the server finish starting up
}
