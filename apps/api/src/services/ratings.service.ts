import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool } from '../db';
import { RatingItem } from '@trakt/types';

export async function getRatings(
  userId: number,
  type: 'movie' | 'show' | 'episode' | 'all',
  sort: 'rating' | 'date',
  page: number,
  limit: number,
): Promise<{ items: RatingItem[]; total: number }> {
  const pool = getPool();
  const offset = (page - 1) * limit;
  const typeWhere = type === 'all' ? '' : ' AND r.media_type = ?';
  const typeParam = type === 'all' ? [] : [type];
  const orderBy = sort === 'rating' ? 'r.rating DESC, r.rated_at DESC' : 'r.rated_at DESC';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       r.id, r.media_type AS mediaType, r.media_id AS mediaId,
       r.rating, r.rated_at AS ratedAt,
       COALESCE(m.tmdb_id, ts.tmdb_id) AS tmdbId,
       COALESCE(m.title, ts.title, e.title) AS title,
       COALESCE(m.poster_path, ts.poster_path) AS posterPath,
       COALESCE(m.year, ts.year) AS year,
       show_for_ep.title AS showTitle,
       seas.season_number AS seasonNumber,
       e.episode_number AS episodeNumber
     FROM ratings r
     LEFT JOIN movies m ON r.media_type='movie' AND m.id=r.media_id
     LEFT JOIN tv_shows ts ON r.media_type='show' AND ts.id=r.media_id
     LEFT JOIN episodes e ON r.media_type='episode' AND e.id=r.media_id
     LEFT JOIN seasons seas ON e.season_id=seas.id
     LEFT JOIN tv_shows show_for_ep ON e.show_id=show_for_ep.id
     WHERE r.user_id=?${typeWhere}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [userId, ...typeParam, limit, offset],
  );

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM ratings WHERE user_id=?${typeWhere}`,
    [userId, ...typeParam],
  );

  return { items: rows as RatingItem[], total: countRow.total as number };
}

export async function upsertRating(
  userId: number,
  mediaType: 'movie' | 'show' | 'episode',
  mediaId: number,
  rating: number,
): Promise<void> {
  await getPool().query(
    `INSERT INTO ratings (user_id, media_type, media_id, rating)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating=?, rated_at=NOW()`,
    [userId, mediaType, mediaId, rating, rating],
  );
}

export async function deleteRating(
  userId: number,
  mediaType: string,
  mediaId: number,
): Promise<boolean> {
  const [result] = await getPool().query<ResultSetHeader>(
    'DELETE FROM ratings WHERE user_id=? AND media_type=? AND media_id=?',
    [userId, mediaType, mediaId],
  );
  return result.affectedRows > 0;
}
