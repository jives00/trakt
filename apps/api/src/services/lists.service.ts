import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool } from '../db';
import { UserList, ListDetail, ListItemEntry, ListType, ListSort, UpdateListBody } from '@trakt/types';

const LIST_FIELDS = `
  l.id, l.name, l.list_type AS listType, l.is_system AS isSystem,
  l.slug, l.is_public AS isPublic, l.default_sort AS defaultSort,
  l.description, l.created_at AS createdAt, l.stremio_catalog AS stremioCatalog,
  COUNT(li.id) AS itemCount`;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function uniqueSlug(userId: number, base: string, excludeId?: number): Promise<string> {
  const pool = getPool();
  let slug = base;
  let i = 1;
  while (true) {
    const excludeClause = excludeId ? ' AND id != ?' : '';
    const params = excludeId ? [userId, slug, excludeId] : [userId, slug];
    const [[row]] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM lists WHERE user_id=? AND slug=?${excludeClause}`,
      params,
    );
    if (!row) return slug;
    slug = `${base}-${i++}`;
  }
}

export async function getLists(userId: number): Promise<UserList[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT ${LIST_FIELDS},
       (SELECT JSON_ARRAYAGG(p) FROM (
         SELECT COALESCE(m2.backdrop_path, ts2.backdrop_path) AS p
         FROM list_items li2
         LEFT JOIN movies m2 ON li2.media_type='movie' AND m2.id=li2.media_id
         LEFT JOIN tv_shows ts2 ON li2.media_type='show' AND ts2.id=li2.media_id
         WHERE li2.list_id=l.id AND COALESCE(m2.backdrop_path, ts2.backdrop_path) IS NOT NULL
         ORDER BY li2.added_at LIMIT 10
       ) sub) AS previewBackdrops
     FROM lists l
     LEFT JOIN list_items li ON li.list_id = l.id
     WHERE l.user_id=?
     GROUP BY l.id
     ORDER BY l.is_system DESC, l.created_at ASC`,
    [userId],
  );
  return rows.map((r) => ({
    ...r,
    previewBackdrops: Array.isArray(r.previewBackdrops) ? r.previewBackdrops : (r.previewBackdrops ? JSON.parse(r.previewBackdrops as string) : []),
  })) as UserList[];
}

export async function getListByType(userId: number, listType: ListType): Promise<ListDetail | null> {
  const pool = getPool();
  const [[list]] = await pool.query<RowDataPacket[]>(
    `SELECT ${LIST_FIELDS}
     FROM lists l
     LEFT JOIN list_items li ON li.list_id = l.id
     WHERE l.user_id=? AND l.list_type=?
     GROUP BY l.id`,
    [userId, listType],
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
    [list.id],
  );

  return { ...(list as UserList), items: items as ListItemEntry[] };
}

export async function createList(
  userId: number,
  name: string,
  description: string | null,
): Promise<UserList> {
  const pool = getPool();
  const slug = await uniqueSlug(userId, slugify(name));
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO lists (user_id, name, description, slug, list_type, is_system) VALUES (?, ?, ?, ?, "custom", FALSE)',
    [userId, name, description ?? null, slug],
  );
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT ${LIST_FIELDS}
     FROM lists l
     LEFT JOIN list_items li ON li.list_id = l.id
     WHERE l.id=?
     GROUP BY l.id`,
    [result.insertId],
  );
  return row as UserList;
}

export async function updateList(
  userId: number,
  listId: number,
  body: UpdateListBody,
): Promise<UserList | null> {
  const pool = getPool();
  const [[existing]] = await pool.query<RowDataPacket[]>(
    'SELECT id, is_system FROM lists WHERE id=? AND user_id=?',
    [listId, userId],
  );
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) {
    if (existing.is_system) throw Object.assign(new Error('Cannot rename system lists'), { code: 'SYSTEM_LIST' });
    const slug = await uniqueSlug(userId, slugify(body.name), listId);
    updates.push('name=?', 'slug=?');
    params.push(body.name, slug);
  }
  if (body.description !== undefined) { updates.push('description=?'); params.push(body.description); }
  if (body.defaultSort !== undefined) { updates.push('default_sort=?'); params.push(body.defaultSort); }
  if (body.isPublic !== undefined) { updates.push('is_public=?'); params.push(body.isPublic); }

  if (updates.length === 0) return getListDetail(userId, listId) as Promise<UserList | null>;

  await pool.query(`UPDATE lists SET ${updates.join(', ')} WHERE id=?`, [...params, listId]);

  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT ${LIST_FIELDS}
     FROM lists l
     LEFT JOIN list_items li ON li.list_id = l.id
     WHERE l.id=?
     GROUP BY l.id`,
    [listId],
  );
  return row as UserList;
}

export async function getListDetail(userId: number, listId: number): Promise<ListDetail | null> {
  const pool = getPool();
  const [[list]] = await pool.query<RowDataPacket[]>(
    `SELECT ${LIST_FIELDS}
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
  const pool = getPool();
  const [[existing]] = await pool.query<RowDataPacket[]>(
    'SELECT is_system FROM lists WHERE id=? AND user_id=?',
    [listId, userId],
  );
  if (!existing) return false;
  if (existing.is_system) throw Object.assign(new Error('Cannot delete system lists'), { code: 'SYSTEM_LIST' });
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM lists WHERE id=? AND user_id=?',
    [listId, userId],
  );
  return result.affectedRows > 0;
}

export async function setListStremioCatalog(
  userId: number,
  listId: number,
  enabled?: boolean,
  sort?: string,
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (enabled !== undefined) { sets.push('stremio_catalog=?'); params.push(enabled); }
  if (sort !== undefined)    { sets.push('stremio_sort=?');    params.push(sort); }
  if (sets.length === 0) return false;
  params.push(listId, userId);
  const [result] = await getPool().query<ResultSetHeader>(
    `UPDATE lists SET ${sets.join(', ')} WHERE id=? AND user_id=?`,
    params,
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

export async function getListMembershipIds(
  userId: number,
  mediaType: string,
  mediaId: number,
): Promise<number[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT li.list_id AS listId
     FROM list_items li
     INNER JOIN lists l ON l.id = li.list_id
     WHERE l.user_id=? AND li.media_type=? AND li.media_id=?`,
    [userId, mediaType, mediaId],
  );
  return rows.map((r) => r.listId as number);
}
