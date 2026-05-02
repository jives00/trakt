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
  mediaType: 'episode' | 'movie';
  showTmdbId?: number;
  showTitle?: string;
  movieTmdbId?: number;
  movieTitle?: string;
  movieTagline?: string | null;
  posterPath: string | null;
  network: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string | null;
  date: string;
  airTime?: string | null;
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

const TRACKED_MOVIES = `(
  SELECT media_id FROM watchlist WHERE user_id = ? AND media_type = 'movie'
  UNION
  SELECT media_id FROM collection WHERE user_id = ? AND media_type = 'movie'
)`;

export async function getSchedule(
  userId: number,
  range = 7,
  type = 'all',
): Promise<ScheduleEntry[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       'episode' AS mediaType,
       s.tmdb_id       AS showTmdbId,
       s.title         AS showTitle,
       NULL            AS movieTmdbId,
       NULL            AS movieTitle,
       NULL            AS movieTagline,
       s.poster_path   AS posterPath,
       s.network,
       seas.season_number AS seasonNumber,
       e.episode_number   AS episodeNumber,
       e.title            AS episodeTitle,
       e.air_date         AS date,
       e.air_time         AS airTime
     FROM tv_shows s
     JOIN ${TRACKED} tracked ON tracked.media_id = s.id
     JOIN seasons seas ON seas.show_id = s.id
     JOIN episodes e   ON e.season_id  = seas.id
     WHERE e.air_date >= CURDATE() AND e.air_date < DATE_ADD(CURDATE(), INTERVAL ? DAY)
     UNION ALL
     SELECT
       'movie'          AS mediaType,
       NULL             AS showTmdbId,
       NULL             AS showTitle,
       m.tmdb_id        AS movieTmdbId,
       m.title          AS movieTitle,
       m.tagline        AS movieTagline,
       m.poster_path    AS posterPath,
       NULL             AS network,
       NULL             AS seasonNumber,
       NULL             AS episodeNumber,
       NULL             AS episodeTitle,
       m.release_date   AS date,
       NULL             AS airTime
     FROM movies m
     JOIN ${TRACKED_MOVIES} tracked_movies ON tracked_movies.media_id = m.id
     WHERE m.release_date >= CURDATE() AND m.release_date < DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY date, showTitle, movieTitle
     LIMIT 100`,
    [userId, userId, range, userId, userId, range],
  );
  return rows as ScheduleEntry[];
}
