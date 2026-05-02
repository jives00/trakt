import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';

export interface UpNextItem {
  showTmdbId: number;
  showTitle: string;
  posterPath: string | null;
  backdropPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeId: number;
  episodeTitle: string | null;
  airDate: string | null;
  watchedCount: number;
  totalAired: number;
}

export interface ScheduleEntry {
  showTmdbId: number;
  showTitle: string;
  network: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  date: string;
}

const TRACKED = `(
  SELECT media_id FROM watchlist WHERE user_id = ? AND media_type = 'show'
  UNION
  SELECT media_id FROM collection WHERE user_id = ? AND media_type = 'show'
)`;

export async function getUpNext(userId: number): Promise<UpNextItem[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       show_id,
       showTmdbId,
       showTitle,
       posterPath,
       backdropPath,
       seasonNumber,
       episodeNumber,
       episodeId,
       episodeTitle,
       airDate
     FROM (
       SELECT
         s.id AS show_id,
         s.tmdb_id  AS showTmdbId,
         s.title    AS showTitle,
         s.poster_path AS posterPath,
         s.backdrop_path AS backdropPath,
         seas.season_number AS seasonNumber,
         e.episode_number AS episodeNumber,
         e.id       AS episodeId,
         e.title    AS episodeTitle,
         e.air_date AS airDate,
         ROW_NUMBER() OVER (
           PARTITION BY s.id
           ORDER BY seas.season_number, e.episode_number
         ) AS rn
       FROM tv_shows s
       JOIN ${TRACKED} tracked ON tracked.media_id = s.id
       JOIN seasons seas ON seas.show_id = s.id
       JOIN episodes e   ON e.season_id  = seas.id
       LEFT JOIN watch_history wh
         ON wh.media_type = 'episode' AND wh.media_id = e.id AND wh.user_id = ?
       WHERE wh.id IS NULL
         AND EXISTS (
           SELECT 1 FROM watch_history wh2
           JOIN episodes e2 ON e2.id = wh2.media_id
           JOIN seasons seas2 ON seas2.id = e2.season_id
           WHERE wh2.media_type = 'episode'
             AND seas2.show_id = s.id
             AND wh2.user_id = ?
           LIMIT 1
         )
     ) sub
     WHERE rn = 1
     ORDER BY showTitle
     LIMIT 20`,
    [userId, userId, userId, userId],
  );

  // Calculate watched/total for each show
  const showIds = rows.map(r => (r as any).show_id);
  if (showIds.length === 0) {
    return rows.map(r => ({ ...(r as UpNextItem), watchedCount: 0, totalAired: 0 }));
  }

  const [counts] = await pool.query<RowDataPacket[]>(
    `SELECT
       s.id,
       COUNT(DISTINCT CASE WHEN wh.id IS NOT NULL THEN wh.media_id END) AS watchedCount,
       COUNT(DISTINCT e.id) AS totalAired
     FROM tv_shows s
     LEFT JOIN seasons seas ON seas.show_id = s.id
     LEFT JOIN episodes e ON e.season_id = seas.id AND e.air_date <= CURDATE()
     LEFT JOIN watch_history wh ON wh.media_type = 'episode' AND wh.media_id = e.id AND wh.user_id = ?
     WHERE s.id IN (${showIds.map(() => '?').join(',')})
     GROUP BY s.id`,
    [userId, ...showIds],
  );

  const countMap = new Map(counts.map(c => [(c as any).id, { watchedCount: (c as any).watchedCount, totalAired: (c as any).totalAired }]));

  return rows.map(row => ({
    ...(row as UpNextItem),
    watchedCount: countMap.get((row as any).show_id)?.watchedCount ?? 0,
    totalAired: countMap.get((row as any).show_id)?.totalAired ?? 0,
  }));
}

export async function getSchedule(
  userId: number,
  range = 6,
  type = 'tv',
): Promise<ScheduleEntry[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       s.tmdb_id       AS showTmdbId,
       s.title         AS showTitle,
       s.network,
       seas.season_number AS seasonNumber,
       e.episode_number   AS episodeNumber,
       e.title            AS episodeTitle,
       e.air_date         AS date
     FROM tv_shows s
     JOIN ${TRACKED} tracked ON tracked.media_id = s.id
     JOIN seasons seas ON seas.show_id = s.id
     JOIN episodes e   ON e.season_id  = seas.id
     WHERE e.air_date >= CURDATE() AND e.air_date < DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY e.air_date, s.title
     LIMIT 100`,
    [userId, userId, range],
  );
  return rows as ScheduleEntry[];
}
