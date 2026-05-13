import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { ProgressItem } from '@trakt/types';

const AIRING_STATUSES = ['Returning Series', 'In Production', 'Pilot'];
const ENDED_STATUSES = ['Ended', 'Canceled', 'Cancelled'];

type ShowRow = ProgressItem & { showId: number };

export async function getProgress(
  userId: number,
  status: 'airing' | 'ended' | 'all',
): Promise<ProgressItem[]> {
  const pool = getPool();

  const [showRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       ts.id AS showId, ts.tmdb_id AS tmdbId, ts.title,
       ts.poster_path AS posterPath, ts.status, ts.network,
       COUNT(DISTINCT e.id) AS totalEpisodes,
       COUNT(DISTINCT wh.media_id) AS watchedEpisodes,
       COUNT(DISTINCT seas.id) AS totalSeasons,
       MAX(wh.watched_at) AS lastWatchedAt,
       rewatch.added_at AS rewatchStartDate
     FROM tv_shows ts
     JOIN (
       SELECT DISTINCT e2.show_id
       FROM watch_history wh2
       JOIN episodes e2 ON e2.id = wh2.media_id
       WHERE wh2.user_id = ? AND wh2.media_type = 'episode'
     ) watched_shows ON watched_shows.show_id = ts.id
     JOIN seasons seas ON seas.show_id = ts.id AND seas.season_number > 0 AND (seas.season_type IS NULL OR seas.season_type != 'special')
     JOIN episodes e ON e.season_id = seas.id
       AND e.air_date IS NOT NULL AND e.air_date <= CURDATE()
     LEFT JOIN watch_history wh
       ON wh.media_type = 'episode' AND wh.media_id = e.id AND wh.user_id = ?
     LEFT JOIN (
       SELECT li.media_id FROM list_items li
       JOIN lists l ON l.id = li.list_id
       WHERE li.media_type = 'show' AND l.list_type = 'dropped' AND l.user_id = ?
     ) dropped_shows ON dropped_shows.media_id = ts.id
     LEFT JOIN (
       SELECT li.media_id, MIN(li.added_at) as added_at FROM list_items li
       JOIN lists l ON l.id = li.list_id
       WHERE li.media_type = 'show' AND l.list_type = 'rewatch' AND l.user_id = ?
       GROUP BY li.media_id
     ) rewatch ON rewatch.media_id = ts.id
     WHERE dropped_shows.media_id IS NULL
     GROUP BY ts.id
     HAVING watchedEpisodes > 0 AND (watchedEpisodes < totalEpisodes OR rewatchStartDate IS NOT NULL)
     ORDER BY lastWatchedAt DESC`,
    [userId, userId, userId, userId],
  );

  let shows = showRows as ShowRow[];

  // For rewatch shows, filter watched episodes to only count those after rewatch started
  const rewatchMap = new Map<number, Date>();
  if (shows.length > 0) {
    const [rewatchDates] = await pool.query<RowDataPacket[]>(
      `SELECT li.media_id, MIN(li.added_at) as added_at FROM list_items li
       JOIN lists l ON l.id = li.list_id
       WHERE li.media_type = 'show' AND l.list_type = 'rewatch' AND l.user_id = ? AND li.media_id IN (${shows.map(() => '?').join(',')})
       GROUP BY li.media_id`,
      [userId, ...shows.map(s => s.showId)],
    );

    rewatchDates.forEach((r: any) => rewatchMap.set(r.media_id, r.added_at));

    // Filter shows with rewatch list to only count recent watches
    for (const show of shows) {
      if (rewatchMap.has(show.showId)) {
        const rewatchDate = rewatchMap.get(show.showId);
        const [recentWatches] = await pool.query<RowDataPacket[]>(
          `SELECT COUNT(DISTINCT wh.media_id) as count FROM watch_history wh
           JOIN episodes e ON e.id = wh.media_id
           WHERE e.show_id = ? AND wh.user_id = ? AND wh.watched_at >= ?`,
          [show.showId, userId, rewatchDate],
        );
        show.watchedEpisodes = Number((recentWatches[0] as any).count);
      }
    }
  }

  if (status === 'airing') {
    shows = shows.filter((s) => AIRING_STATUSES.includes(s.status ?? ''));
  } else if (status === 'ended') {
    shows = shows.filter((s) => ENDED_STATUSES.includes(s.status ?? ''));
  }

  if (shows.length === 0) return [];

  const showIds = shows.map((s) => s.showId);
  const nextEpMap = new Map<number, ProgressItem['nextEpisode']>();

  // For each show, find the next episode (handling rewatch dates)
  for (const show of shows) {
    const rewatchDate = rewatchMap.get(show.showId);

    // Find last watched episode (considering rewatch date cutoff)
    const [lastWatchedRows] = await pool.query<RowDataPacket[]>(
      `SELECT seas.season_number, e.episode_number FROM watch_history wh
       JOIN episodes e ON e.id = wh.media_id
       JOIN seasons seas ON seas.id = e.season_id AND seas.show_id = ?
       WHERE wh.media_type = 'episode' AND wh.user_id = ? ${rewatchDate ? 'AND wh.watched_at >= ?' : ''}
       ORDER BY wh.watched_at DESC LIMIT 1`,
      rewatchDate ? [show.showId, userId, rewatchDate] : [show.showId, userId],
    );

    const lastSeason: number = (lastWatchedRows[0] as any)?.season_number ?? 0;
    const lastEp: number = (lastWatchedRows[0] as any)?.episode_number ?? 0;

    // Find next unwatched episode after last watched
    const [nextEpRows] = await pool.query<RowDataPacket[]>(
      `SELECT seas.season_number AS seasonNumber, e.episode_number AS episodeNumber, e.title AS episodeTitle
       FROM episodes e
       JOIN seasons seas ON seas.id = e.season_id AND seas.show_id = ?
       WHERE e.air_date IS NOT NULL AND e.air_date <= CURDATE()
         AND seas.season_number > 0
         AND (seas.season_number > ? OR (seas.season_number = ? AND e.episode_number > ?))
         AND NOT EXISTS (
           SELECT 1 FROM watch_history wh WHERE wh.media_type = 'episode' AND wh.media_id = e.id AND wh.user_id = ? ${rewatchDate ? 'AND wh.watched_at >= ?' : ''}
         )
       ORDER BY seas.season_number, e.episode_number LIMIT 1`,
      rewatchDate
        ? [show.showId, lastSeason, lastSeason, lastEp, userId, rewatchDate]
        : [show.showId, lastSeason, lastSeason, lastEp, userId],
    );

    if (nextEpRows.length > 0) {
      const r = nextEpRows[0] as any;
      nextEpMap.set(show.showId, {
        seasonNumber: r.seasonNumber,
        episodeNumber: r.episodeNumber,
        title: r.episodeTitle ?? null,
      });
    }
  }

  return shows.map((s) => ({
    ...s,
    totalEpisodes: Number(s.totalEpisodes),
    watchedEpisodes: Number(s.watchedEpisodes),
    totalSeasons: Number(s.totalSeasons),
    nextEpisode: nextEpMap.get(s.showId) ?? null,
  }));
}
