import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { StatsAllTime, StatsYear, StatsMonth, DailyActivity } from '@trakt/types';
import {
  RUNTIME_EXPR, MEDIA_JOINS,
  dateClause, longestStreak, queryTopShows, queryTopGenres, queryTotalMinutes,
} from './stats-helpers';

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
