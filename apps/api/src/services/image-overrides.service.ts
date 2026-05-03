import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { fetchMediaImages } from './tmdb.client';

interface OverrideRow extends RowDataPacket { media_type: string; tmdb_id: number; image_type: string; path: string }

export async function applyImageOverrides<T extends { tmdbId: number; posterPath: string | null; backdropPath: string | null }>(
  mediaType: 'show' | 'movie',
  item: T,
): Promise<T> {
  const pool = getPool();
  const [rows] = await pool.query<OverrideRow[]>(
    `SELECT image_type, path FROM media_image_overrides WHERE media_type = ? AND tmdb_id = ?`,
    [mediaType, item.tmdbId],
  );
  for (const row of rows) {
    if (row.image_type === 'hero') item.backdropPath = row.path;
    if (row.image_type === 'poster') item.posterPath = row.path;
  }
  return item;
}

export async function setImageOverride(
  mediaType: 'show' | 'movie',
  tmdbId: number,
  imageType: 'hero' | 'poster',
  path: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO media_image_overrides (media_type, tmdb_id, image_type, path)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE path = VALUES(path), updated_at = CURRENT_TIMESTAMP`,
    [mediaType, tmdbId, imageType, path],
  );
}

export async function batchApplyImageOverrides(
  items: { mediaType: 'show' | 'movie'; tmdbId: number }[],
): Promise<Map<string, { posterPath?: string; backdropPath?: string }>> {
  if (items.length === 0) return new Map();
  const pool = getPool();
  const placeholders = items.map(() => '(?,?)').join(',');
  const params = items.flatMap((i) => [i.mediaType, i.tmdbId]);
  const [rows] = await pool.query<OverrideRow[]>(
    `SELECT media_type, tmdb_id, image_type, path
     FROM media_image_overrides
     WHERE (media_type, tmdb_id) IN (${placeholders})`,
    params,
  );
  const map = new Map<string, { posterPath?: string; backdropPath?: string }>();
  for (const row of rows) {
    const key = `${row.media_type}:${row.tmdb_id}`;
    const entry = map.get(key) ?? {};
    if (row.image_type === 'hero') entry.backdropPath = row.path;
    if (row.image_type === 'poster') entry.posterPath = row.path;
    map.set(key, entry);
  }
  return map;
}

export async function getAvailableImages(
  mediaType: 'show' | 'movie',
  tmdbId: number,
): Promise<{ backdrops: string[]; posters: string[] }> {
  return fetchMediaImages(mediaType, tmdbId);
}
