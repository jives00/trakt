import { RowDataPacket } from 'mysql2/promise';
import { RecommendationItem } from '@trakt/types';
import { getPool } from '../db';
import { fetchMovieRecommendations, fetchShowRecommendations } from './tmdb.client';

const SEEDS = 5;
const LIMIT = 3;

export async function getShowRecommendations(userId: number): Promise<RecommendationItem[]> {
  const pool = getPool();

  const [watchedRows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT ts.tmdb_id
     FROM watch_history wh
     JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id
     JOIN tv_shows ts ON e.show_id=ts.id
     WHERE wh.user_id=?`,
    [userId],
  );
  const watchedIds = new Set(watchedRows.map((r) => r['tmdb_id'] as number));

  const [seedRows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT tmdb_id FROM (
       SELECT ts.tmdb_id, MAX(wh.watched_at) AS last_watched
       FROM watch_history wh
       JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id
       JOIN tv_shows ts ON e.show_id=ts.id
       WHERE wh.user_id=?
       GROUP BY ts.tmdb_id
       ORDER BY last_watched DESC
       LIMIT ?
     ) sub`,
    [userId, SEEDS],
  );
  const seeds = seedRows.map((r) => r['tmdb_id'] as number);
  if (seeds.length === 0) return [];

  const pages = await Promise.allSettled(seeds.map(fetchShowRecommendations));
  const seen = new Set<number>();
  const results: RecommendationItem[] = [];

  for (const page of pages) {
    if (page.status !== 'fulfilled') continue;
    for (const r of page.value) {
      if (seen.has(r.id) || watchedIds.has(r.id)) continue;
      seen.add(r.id);
      results.push({
        tmdbId: r.id,
        title: r.name ?? '',
        year: r.first_air_date ? Number(String(r.first_air_date).slice(0, 4)) : null,
        posterPath: r.poster_path ?? null,
        overview: r.overview ?? '',
      });
      if (results.length >= LIMIT) return results;
    }
  }
  return results;
}

export async function getMovieRecommendations(userId: number): Promise<RecommendationItem[]> {
  const pool = getPool();

  const [watchedRows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT m.tmdb_id
     FROM watch_history wh
     JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
     WHERE wh.user_id=?`,
    [userId],
  );
  const watchedIds = new Set(watchedRows.map((r) => r['tmdb_id'] as number));

  const [seedRows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT tmdb_id FROM (
       SELECT m.tmdb_id, MAX(wh.watched_at) AS last_watched
       FROM watch_history wh
       JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
       WHERE wh.user_id=?
       GROUP BY m.tmdb_id
       ORDER BY last_watched DESC
       LIMIT ?
     ) sub`,
    [userId, SEEDS],
  );
  const seeds = seedRows.map((r) => r['tmdb_id'] as number);
  if (seeds.length === 0) return [];

  const pages = await Promise.allSettled(seeds.map(fetchMovieRecommendations));
  const seen = new Set<number>();
  const results: RecommendationItem[] = [];

  for (const page of pages) {
    if (page.status !== 'fulfilled') continue;
    for (const r of page.value) {
      if (seen.has(r.id) || watchedIds.has(r.id)) continue;
      seen.add(r.id);
      results.push({
        tmdbId: r.id,
        title: r.title ?? '',
        year: r.release_date ? Number(String(r.release_date).slice(0, 4)) : null,
        posterPath: r.poster_path ?? null,
        overview: r.overview ?? '',
      });
      if (results.length >= LIMIT) return results;
    }
  }
  return results;
}
