import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { TopShow, TopGenre } from '@trakt/types';

export const DEFAULT_RUNTIME = 45;

export const RUNTIME_EXPR = `COALESCE(
  CASE WHEN wh.media_type='movie' THEN m.runtime_min ELSE e.runtime_min END,
  ${DEFAULT_RUNTIME}
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
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.genres
     FROM watch_history wh
     JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
     WHERE wh.user_id=?${dc} AND m.genres IS NOT NULL
     UNION ALL
     SELECT ts.genres
     FROM watch_history wh
     JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id
     JOIN tv_shows ts ON e.show_id=ts.id
     WHERE wh.user_id=?${dc} AND ts.genres IS NOT NULL`,
    [userId, ...dp, userId, ...dp],
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const genres: string[] = Array.isArray(row.genres)
      ? row.genres
      : JSON.parse(row.genres as string);
    for (const g of genres) counts[g] = (counts[g] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre, count]) => ({ genre, count }));
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
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT show_id) AS count FROM (
       SELECT e.show_id,
         (SELECT COUNT(*) FROM episodes WHERE show_id = e.show_id) AS total_episodes,
         (SELECT COUNT(*) FROM watch_history wh2
          WHERE wh2.user_id = ? AND wh2.media_type='episode'
            AND wh2.media_id IN (SELECT id FROM episodes WHERE show_id = e.show_id)
         ) AS watched_episodes
       FROM watch_history wh
       JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id
       WHERE wh.user_id=? AND YEAR(wh.watched_at)=?
       GROUP BY e.show_id
     ) shows_in_year
     WHERE total_episodes = watched_episodes`,
    [userId, userId, year],
  );
  return Number(row.count ?? 0);
}
