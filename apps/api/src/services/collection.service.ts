import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { CollectionItem, WatchlistItem } from '@trakt/types';

const MEDIA_JOIN_SELECT = `
  t.id, t.media_type AS mediaType, t.media_id AS mediaId, t.added_at AS addedAt,
  COALESCE(m.tmdb_id, ts.tmdb_id) AS tmdbId,
  COALESCE(m.title, ts.title) AS title,
  COALESCE(m.poster_path, ts.poster_path) AS posterPath,
  COALESCE(m.year, ts.year) AS year`;

const MEDIA_JOIN_FROM = `
  LEFT JOIN movies m ON t.media_type='movie' AND m.id=t.media_id
  LEFT JOIN tv_shows ts ON t.media_type='show' AND ts.id=t.media_id`;

export async function getCollection(
  userId: number,
  type: 'movie' | 'show' | 'all',
): Promise<CollectionItem[]> {
  const pool = getPool();
  const typeWhere = type === 'all' ? '' : ' AND t.media_type = ?';
  const typeParam = type === 'all' ? [] : [type];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${MEDIA_JOIN_SELECT} FROM collection t ${MEDIA_JOIN_FROM}
     WHERE t.user_id=?${typeWhere} ORDER BY t.added_at DESC`,
    [userId, ...typeParam],
  );
  return rows as CollectionItem[];
}

export async function getWatchlist(
  userId: number,
  type: 'movie' | 'show' | 'all',
): Promise<WatchlistItem[]> {
  const pool = getPool();
  const typeWhere = type === 'all' ? '' : ' AND t.media_type = ?';
  const typeParam = type === 'all' ? [] : [type];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${MEDIA_JOIN_SELECT} FROM watchlist t ${MEDIA_JOIN_FROM}
     WHERE t.user_id=?${typeWhere} ORDER BY t.added_at DESC`,
    [userId, ...typeParam],
  );
  return rows as WatchlistItem[];
}
