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
}

export interface ScheduleEntry {
  showTmdbId: number;
  showTitle: string;
  network: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  airDate: string;
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
       show_tmdb_id  AS showTmdbId,
       show_title    AS showTitle,
       poster_path   AS posterPath,
       backdrop_path AS backdropPath,
       season_number AS seasonNumber,
       episode_number AS episodeNumber,
       episode_id    AS episodeId,
       episode_title AS episodeTitle,
       air_date      AS airDate
     FROM (
       SELECT
         s.tmdb_id  AS show_tmdb_id,
         s.title    AS show_title,
         s.poster_path,
         s.backdrop_path,
         seas.season_number,
         e.episode_number,
         e.id       AS episode_id,
         e.title    AS episode_title,
         e.air_date,
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
     ) sub
     WHERE rn = 1
     ORDER BY show_title
     LIMIT 20`,
    [userId, userId, userId],
  );
  return rows as UpNextItem[];
}

export async function getSchedule(userId: number): Promise<ScheduleEntry[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       s.tmdb_id       AS showTmdbId,
       s.title         AS showTitle,
       s.network,
       seas.season_number AS seasonNumber,
       e.episode_number   AS episodeNumber,
       e.title            AS episodeTitle,
       e.air_date         AS airDate
     FROM tv_shows s
     JOIN ${TRACKED} tracked ON tracked.media_id = s.id
     JOIN seasons seas ON seas.show_id = s.id
     JOIN episodes e   ON e.season_id  = seas.id
     WHERE e.air_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 6 DAY)
     ORDER BY e.air_date, s.title
     LIMIT 50`,
    [userId, userId],
  );
  return rows as ScheduleEntry[];
}
