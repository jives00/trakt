import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { batchApplyImageOverrides } from './image-overrides.service';
import { DashboardStats, DashboardGenre, RecentItem } from '@trakt/types';
import { RUNTIME_EXPR, MEDIA_JOINS } from './stats-helpers';

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
     WHERE wh.user_id=? AND (wh.completion_progress >= 100 OR wh.playback_stopped_at IS NOT NULL)
     ORDER BY wh.watched_at DESC
     LIMIT ?`,
    [userId, limit],
  );

  const overrides = await batchApplyImageOverrides(
    (rows as any[]).map(r => ({
      mediaType: r.mediaType === 'movie' ? 'movie' as const : 'show' as const,
      tmdbId: r.tmdbId,
    })),
  );

  return (rows as any[]).map(r => {
    const mt = r.mediaType === 'movie' ? 'movie' : 'show';
    const ovr = overrides.get(`${mt}:${r.tmdbId}`) ?? {};
    return { ...r, posterPath: ovr.posterPath ?? r.posterPath } as RecentItem;
  });
}
