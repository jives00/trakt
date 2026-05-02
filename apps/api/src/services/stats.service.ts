import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import {
  StatsAllTime, StatsYear, StatsMonth,
  DashboardDailyStats, DashboardStats, DashboardGenre, RecentItem, TopShow, TopGenre, DailyActivity,
} from '@trakt/types';

const DEFAULT_RUNTIME = 45;

const RUNTIME_EXPR = `COALESCE(
  CASE WHEN wh.media_type='movie' THEN m.runtime_min ELSE e.runtime_min END,
  ${DEFAULT_RUNTIME}
)`;

const MEDIA_JOINS = `
  LEFT JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
  LEFT JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id`;

function dateClause(year?: number, month?: number): { sql: string; params: number[] } {
  const parts: string[] = [];
  const params: number[] = [];
  if (year !== undefined) { parts.push('YEAR(wh.watched_at) = ?'); params.push(year); }
  if (month !== undefined) { parts.push('MONTH(wh.watched_at) = ?'); params.push(month); }
  return { sql: parts.length ? ' AND ' + parts.join(' AND ') : '', params };
}

function longestStreak(dates: string[]): number {
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

async function queryTopShows(
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

async function queryTopGenres(
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

async function queryTotalMinutes(
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

export async function getStatsAllTime(userId: number): Promise<StatsAllTime> {
  const pool = getPool();

  const [
    [[counts]],
    minutes,
    shows,
    genres,
    [heatmapRows],
    [[{ totalShows }]],
  ] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(CASE WHEN media_type='movie' THEN 1 END) AS totalMovies,
         COUNT(CASE WHEN media_type='episode' THEN 1 END) AS totalEpisodes
       FROM watch_history WHERE user_id=?`,
      [userId],
    ),
    queryTotalMinutes(pool, userId),
    queryTopShows(pool, userId),
    queryTopGenres(pool, userId),
    pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(DATE(watched_at), '%Y-%m-%d') AS date, COUNT(*) AS count
       FROM watch_history WHERE user_id=?
       GROUP BY DATE_FORMAT(DATE(watched_at), '%Y-%m-%d') ORDER BY date`,
      [userId],
    ),
    pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT e.show_id) AS totalShows
       FROM watch_history wh JOIN episodes e ON e.id=wh.media_id
       WHERE wh.user_id=? AND wh.media_type='episode'`,
      [userId],
    ),
  ]);

  const heatmap: DailyActivity[] = (heatmapRows as RowDataPacket[]).map((r) => ({
    date: r.date as string,
    count: Number(r.count),
  }));

  return {
    totalMinutes: minutes,
    totalMovies: Number(counts.totalMovies),
    totalEpisodes: Number(counts.totalEpisodes),
    totalShows: Number(totalShows),
    longestStreak: longestStreak(heatmap.map((h) => h.date)),
    topShows: shows,
    topGenres: genres,
    heatmap,
  };
}

export async function getStatsYear(userId: number, year: number): Promise<StatsYear> {
  const pool = getPool();

  const [
    [[counts]],
    minutes,
    shows,
    genres,
    [monthlyRows],
    [[{ newShowsStarted }]],
  ] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(CASE WHEN media_type='movie' THEN 1 END) AS totalMovies,
         COUNT(CASE WHEN media_type='episode' THEN 1 END) AS totalEpisodes
       FROM watch_history WHERE user_id=? AND YEAR(watched_at)=?`,
      [userId, year],
    ),
    queryTotalMinutes(pool, userId, year),
    queryTopShows(pool, userId, year),
    queryTopGenres(pool, userId, year),
    pool.query<RowDataPacket[]>(
      `SELECT MONTH(wh.watched_at) AS month,
         SUM(${RUNTIME_EXPR}) / 60.0 AS hours
       FROM watch_history wh ${MEDIA_JOINS}
       WHERE wh.user_id=? AND YEAR(wh.watched_at)=?
       GROUP BY MONTH(wh.watched_at) ORDER BY month`,
      [userId, year],
    ),
    pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT e.show_id) AS newShowsStarted
       FROM watch_history wh JOIN episodes e ON e.id=wh.media_id
       WHERE wh.user_id=? AND wh.media_type='episode' AND YEAR(wh.watched_at)=?
         AND e.show_id NOT IN (
           SELECT DISTINCT e2.show_id FROM watch_history wh2
           JOIN episodes e2 ON e2.id=wh2.media_id
           WHERE wh2.user_id=? AND wh2.media_type='episode' AND YEAR(wh2.watched_at) < ?
         )`,
      [userId, year, userId, year],
    ),
  ]);

  return {
    year,
    totalMinutes: minutes,
    totalMovies: Number(counts.totalMovies),
    totalEpisodes: Number(counts.totalEpisodes),
    newShowsStarted: Number(newShowsStarted),
    showsCompleted: 0,
    monthlyBreakdown: (monthlyRows as RowDataPacket[]).map((r) => ({
      month: Number(r.month),
      hours: Number(r.hours),
    })),
    topShows: shows,
    topGenres: genres,
  };
}

export async function getStatsMonth(userId: number, year: number, month: number): Promise<StatsMonth> {
  const pool = getPool();

  const [
    [[counts]],
    minutes,
    [dailyRows],
    shows,
    [movieRows],
  ] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(CASE WHEN media_type='movie' THEN 1 END) AS totalMovies,
         COUNT(CASE WHEN media_type='episode' THEN 1 END) AS totalEpisodes
       FROM watch_history WHERE user_id=? AND YEAR(watched_at)=? AND MONTH(watched_at)=?`,
      [userId, year, month],
    ),
    queryTotalMinutes(pool, userId, year, month),
    pool.query<RowDataPacket[]>(
      `SELECT DAY(wh.watched_at) AS day,
         SUM(${RUNTIME_EXPR}) / 60.0 AS hours
       FROM watch_history wh ${MEDIA_JOINS}
       WHERE wh.user_id=? AND YEAR(wh.watched_at)=? AND MONTH(wh.watched_at)=?
       GROUP BY DAY(wh.watched_at) ORDER BY day`,
      [userId, year, month],
    ),
    queryTopShows(pool, userId, year, month),
    pool.query<RowDataPacket[]>(
      `SELECT DISTINCT m.tmdb_id AS tmdbId, m.title, m.poster_path AS posterPath
       FROM watch_history wh JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
       WHERE wh.user_id=? AND YEAR(wh.watched_at)=? AND MONTH(wh.watched_at)=?`,
      [userId, year, month],
    ),
  ]);

  return {
    year,
    month,
    totalMinutes: minutes,
    totalMovies: Number(counts.totalMovies),
    totalEpisodes: Number(counts.totalEpisodes),
    dailyBreakdown: (dailyRows as RowDataPacket[]).map((r) => ({
      day: Number(r.day),
      hours: Number(r.hours),
    })),
    shows,
    movies: movieRows as { tmdbId: number; title: string; posterPath: string | null }[],
  };
}

export async function getDashboardStats(userId: number): Promise<DashboardStats> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(DATE(wh.watched_at), '%Y-%m-%d') AS date,
       SUM(${RUNTIME_EXPR}) / 60.0 AS hours,
       SUM(wh.media_type = 'episode') AS episodes,
       SUM(wh.media_type = 'movie') AS movies
     FROM watch_history wh ${MEDIA_JOINS}
     WHERE wh.user_id=? AND wh.watched_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
     GROUP BY DATE_FORMAT(DATE(wh.watched_at), '%Y-%m-%d') ORDER BY date`,
    [userId],
  );
  const [[summary]] = await pool.query<RowDataPacket[]>(
    `SELECT
       SUM(${RUNTIME_EXPR}) AS totalMinutes,
       SUM(wh.media_type = 'episode') AS episodes,
       SUM(wh.media_type = 'movie') AS movies,
       COUNT(*) AS plays
     FROM watch_history wh ${MEDIA_JOINS}
     WHERE wh.user_id=? AND wh.watched_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`,
    [userId],
  );
  const [epGenreRows] = await pool.query<RowDataPacket[]>(
    `SELECT ts.genres, ts.id AS showId
     FROM watch_history wh
     JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id
     JOIN tv_shows ts ON e.show_id=ts.id
     WHERE wh.user_id=? AND wh.watched_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) AND ts.genres IS NOT NULL`,
    [userId],
  );
  const [movGenreRows] = await pool.query<RowDataPacket[]>(
    `SELECT m.genres
     FROM watch_history wh
     JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
     WHERE wh.user_id=? AND wh.watched_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) AND m.genres IS NOT NULL`,
    [userId],
  );
  const genreMap = new Map<string, { episodes: number; movies: number; shows: Set<number> }>();
  for (const row of epGenreRows) {
    const genres: string[] = Array.isArray(row.genres) ? row.genres : JSON.parse(row.genres as string);
    for (const g of genres) {
      if (!genreMap.has(g)) genreMap.set(g, { episodes: 0, movies: 0, shows: new Set() });
      const entry = genreMap.get(g)!;
      entry.episodes++;
      entry.shows.add(row.showId as number);
    }
  }
  for (const row of movGenreRows) {
    const genres: string[] = Array.isArray(row.genres) ? row.genres : JSON.parse(row.genres as string);
    for (const g of genres) {
      if (!genreMap.has(g)) genreMap.set(g, { episodes: 0, movies: 0, shows: new Set() });
      genreMap.get(g)!.movies++;
    }
  }
  const genres: DashboardGenre[] = Array.from(genreMap.entries())
    .map(([genre, { episodes, movies, shows }]) => ({
      genre,
      episodes,
      movies,
      shows: shows.size,
      plays: episodes + movies,
    }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 8);

  return {
    daily: (rows as RowDataPacket[]).map((r) => ({
      date: r.date as string,
      hours: Number(r.hours),
      episodes: Number(r.episodes ?? 0),
      movies: Number(r.movies ?? 0),
    })),
    summary: {
      totalMinutes: Number(summary.totalMinutes ?? 0),
      episodes: Number(summary.episodes ?? 0),
      movies: Number(summary.movies ?? 0),
      plays: Number(summary.plays ?? 0),
    },
    genres,
  };
}

export async function getRecentItems(userId: number, limit = 10): Promise<RecentItem[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       wh.id, wh.media_type AS mediaType, wh.media_id AS mediaId,
       wh.watched_at AS watchedAt, wh.source,
       COALESCE(m.tmdb_id, ts.tmdb_id) AS tmdbId,
       CASE WHEN wh.media_type='movie' THEN m.title ELSE e.title END AS title,
       CASE WHEN wh.media_type='movie' THEN m.poster_path ELSE ts.poster_path END AS posterPath,
       e.still_path AS stillPath,
       m.tagline AS tagline,
       ts.title AS showTitle,
       seas.season_number AS seasonNumber,
       e.episode_number AS episodeNumber
     FROM watch_history wh
     LEFT JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
     LEFT JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id
     LEFT JOIN seasons seas ON e.season_id=seas.id
     LEFT JOIN tv_shows ts ON e.show_id=ts.id
     WHERE wh.user_id=?
     ORDER BY wh.watched_at DESC
     LIMIT ?`,
    [userId, limit],
  );
  return rows as RecentItem[];
}
