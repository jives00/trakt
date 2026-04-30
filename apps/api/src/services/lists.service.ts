import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool } from '../db';
import { UserList, ListDetail, ListItemEntry } from '@trakt/types';

export async function getLists(userId: number): Promise<UserList[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT l.id, l.name, l.description, l.privacy, l.created_at AS createdAt,
       COUNT(li.id) AS itemCount
     FROM lists l
     LEFT JOIN list_items li ON li.list_id = l.id
     WHERE l.user_id=?
     GROUP BY l.id
     ORDER BY l.created_at DESC`,
    [userId],
  );
  return rows as UserList[];
}

export async function createList(
  userId: number,
  name: string,
  description: string | null,
): Promise<UserList> {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO lists (user_id, name, description) VALUES (?, ?, ?)',
    [userId, name, description ?? null],
  );
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, description, privacy, created_at AS createdAt, 0 AS itemCount
     FROM lists WHERE id=?`,
    [result.insertId],
  );
  return row as UserList;
}

export async function getListDetail(userId: number, listId: number): Promise<ListDetail | null> {
  const pool = getPool();
  const [[list]] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, l.name, l.description, l.privacy, l.created_at AS createdAt,
       COUNT(li.id) AS itemCount
     FROM lists l
     LEFT JOIN list_items li ON li.list_id = l.id
     WHERE l.id=? AND l.user_id=?
     GROUP BY l.id`,
    [listId, userId],
  );
  if (!list) return null;

  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT li.id, li.media_type AS mediaType, li.media_id AS mediaId,
       li.added_at AS addedAt, li.sort_order AS sortOrder,
       COALESCE(m.tmdb_id, ts.tmdb_id) AS tmdbId,
       COALESCE(m.title, ts.title, e.title) AS title,
       COALESCE(m.poster_path, ts.poster_path) AS posterPath,
       COALESCE(m.year, ts.year) AS year
     FROM list_items li
     LEFT JOIN movies m ON li.media_type='movie' AND m.id=li.media_id
     LEFT JOIN tv_shows ts ON li.media_type='show' AND ts.id=li.media_id
     LEFT JOIN episodes e ON li.media_type='episode' AND e.id=li.media_id
     WHERE li.list_id=?
     ORDER BY li.sort_order, li.added_at`,
    [listId],
  );

  return { ...(list as UserList), items: items as ListItemEntry[] };
}

export async function deleteList(userId: number, listId: number): Promise<boolean> {
  const [result] = await getPool().query<ResultSetHeader>(
    'DELETE FROM lists WHERE id=? AND user_id=?',
    [listId, userId],
  );
  return result.affectedRows > 0;
}

export async function addListItem(
  listId: number,
  mediaType: 'movie' | 'show' | 'episode',
  mediaId: number,
): Promise<void> {
  const pool = getPool();
  const [[{ maxOrder }]] = await pool.query<RowDataPacket[]>(
    'SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM list_items WHERE list_id=?',
    [listId],
  );
  await pool.query(
    'INSERT IGNORE INTO list_items (list_id, media_type, media_id, sort_order) VALUES (?, ?, ?, ?)',
    [listId, mediaType, mediaId, (maxOrder as number) + 1],
  );
}

export async function removeListItem(
  listId: number,
  mediaType: string,
  mediaId: number,
): Promise<boolean> {
  const [result] = await getPool().query<ResultSetHeader>(
    'DELETE FROM list_items WHERE list_id=? AND media_type=? AND media_id=?',
    [listId, mediaType, mediaId],
  );
  return result.affectedRows > 0;
}
