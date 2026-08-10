import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { TopShow, TopGenre } from '@trakt/types';

export const DEFAULT_RUNTIME = 45;
export const DEFAULT_MOVIE_RUNTIME = 120;

// NULLIF because TMDB stores unreleased/partial titles with runtime 0, which COALESCE would keep.
export const RUNTIME_EXPR = `COALESCE(
  NULLIF(CASE WHEN wh.media_type='movie' THEN m.runtime_min ELSE e.runtime_min END, 0),
  CASE WHEN wh.media_type='movie' THEN ${DEFAULT_MOVIE_RUNTIME} ELSE ${DEFAULT_RUNTIME} END
)`;

export const MEDIA_JOINS = `
  LEFT JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
  LEFT JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id`;

export function dateClause(year?: number, month?: number): { sql: string; params: number[] } {
  const parts: string[] = [];
  const params: number[] = [];
  if (year !== undefined) { parts.push('YEAR(wh.watched_at) = ?'); params.push(year); }
  if (month !== undefined) { parts.push('MONTH(wh.watched_at) = ?'); params.push(month); }
  return { sql: parts.length ? ' AND ' + parts.join(' AND ') : '', params };
}

export function longestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort();
  let max = 1;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000;
    streak = diff === 1 ? streak + 1 : 1;
    if (streak > max) max = streak;
  }
  return max;
}

export async function queryTopShows(
  pool: ReturnType<typeof getPool>,
  userId: number,
  year?: number,
  month?: number,
): Promise<TopShow[]> {
  const { sql, params } = dateClause(year, month);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ts.tmdb_id AS tmdbId, ts.title, ts.poster_path AS posterPath,
       COUNT(wh.id) AS episodeCount
     FROM watch_history wh
     JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id
     JOIN tv_shows ts ON e.show_id=ts.id
     WHERE wh.user_id=?${sql}
     GROUP BY ts.id ORDER BY episodeCount DESC LIMIT 10`,
    [userId, ...params],
  );
  return rows.map((r) => ({ ...r, episodeCount: Number(r.episodeCount) })) as TopShow[];
}

export async function queryTopGenres(
  pool: ReturnType<typeof getPool>,
  userId: number,
  year?: number,
  month?: number,
): Promise<TopGenre[]> {
  const { sql: dc, params: dp } = dateClause(year, month);
  // JSON_TABLE expands the genres array server-side so only 10 rows are returned to Node.
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT genre, COUNT(*) AS count
     FROM (
       SELECT jt.genre
       FROM watch_history wh
       JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
       JOIN JSON_TABLE(m.genres, '$[*]' COLUMNS (genre VARCHAR(100) PATH '$')) jt
       WHERE wh.user_id=?${dc} AND m.genres IS NOT NULL
       UNION ALL
       SELECT jt.genre
       FROM watch_history wh
       JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id
       JOIN tv_shows ts ON ts.id=e.show_id
       JOIN JSON_TABLE(ts.genres, '$[*]' COLUMNS (genre VARCHAR(100) PATH '$')) jt
       WHERE wh.user_id=?${dc} AND ts.genres IS NOT NULL
     ) g
     GROUP BY genre
     ORDER BY count DESC
     LIMIT 10`,
    [userId, ...dp, userId, ...dp],
  );
  return rows.map((r) => ({ genre: String(r.genre), count: Number(r.count) })) as TopGenre[];
}

export async function queryTotalMinutes(
  pool: ReturnType<typeof getPool>,
  userId: number,
  year?: number,
  month?: number,
): Promise<number> {
  const { sql, params } = dateClause(year, month);
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT SUM(${RUNTIME_EXPR}) AS total
     FROM watch_history wh ${MEDIA_JOINS}
     WHERE wh.user_id=?${sql}`,
    [userId, ...params],
  );
  return Number(row.total ?? 0);
}

export async function queryShowsCompleted(
  pool: ReturnType<typeof getPool>,
  userId: number,
  year: number,
): Promise<number> {
  // Replaces two correlated subqueries per show with a self-join on episodes + LEFT JOIN on
  // watch_history. Shows watched at least once in the given year where all episodes are watched
  // at any time are counted as completed.
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM (
       SELECT e.show_id,
         COUNT(DISTINCT all_eps.id)    AS total_eps,
         COUNT(DISTINCT wh_all.media_id) AS watched_eps
       FROM watch_history wh
       JOIN episodes e ON wh.media_type = 'episode' AND e.id = wh.media_id
       JOIN episodes all_eps ON all_eps.show_id = e.show_id
       LEFT JOIN watch_history wh_all
         ON wh_all.user_id = ? AND wh_all.media_type = 'episode' AND wh_all.media_id = all_eps.id
       WHERE wh.user_id = ? AND YEAR(wh.watched_at) = ?
       GROUP BY e.show_id
       HAVING watched_eps = total_eps
     ) completed`,
    [userId, userId, year],
  );
  return Number(row.count ?? 0);
}
