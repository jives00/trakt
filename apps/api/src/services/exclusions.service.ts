import { RowDataPacket, OkPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { ScrobbleExclusion, CreateExclusionBody } from '@trakt/types';

export async function getExclusions(integration?: string): Promise<ScrobbleExclusion[]> {
  const pool = getPool();

  let query = `
    SELECT id, integration, tmdb_id AS tmdbId, media_type AS mediaType, title, created_at AS createdAt
    FROM scrobble_exclusions
  `;
  const params: (string | undefined)[] = [];

  if (integration) {
    query += ' WHERE integration = ?';
    params.push(integration);
  }

  query += ' ORDER BY created_at DESC';

  const [rows] = await pool.query<RowDataPacket[]>(query, params);
  return rows as ScrobbleExclusion[];
}

export async function createExclusion(body: CreateExclusionBody): Promise<ScrobbleExclusion> {
  const pool = getPool();

  const [result] = await pool.query<OkPacket>(
    `INSERT IGNORE INTO scrobble_exclusions (integration, tmdb_id, media_type, title) VALUES (?, ?, ?, ?)`,
    [body.integration, body.tmdbId, body.mediaType, body.title],
  );

  const id = result.insertId || (await getExclusionByKey(body.integration, body.tmdbId, body.mediaType))?.id;
  if (!id) throw new Error('Failed to create or find exclusion');

  return getExclusionById(id);
}

export async function deleteExclusion(id: number): Promise<boolean> {
  const pool = getPool();

  const [result] = await pool.query<OkPacket>(
    `DELETE FROM scrobble_exclusions WHERE id = ?`,
    [id],
  );

  return result.affectedRows > 0;
}

async function getExclusionById(id: number): Promise<ScrobbleExclusion> {
  const pool = getPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, integration, tmdb_id AS tmdbId, media_type AS mediaType, title, created_at AS createdAt
     FROM scrobble_exclusions WHERE id = ?`,
    [id],
  );

  if (rows.length === 0) throw new Error('Exclusion not found');
  return rows[0] as ScrobbleExclusion;
}

async function getExclusionByKey(
  integration: string,
  tmdbId: number,
  mediaType: string,
): Promise<ScrobbleExclusion | null> {
  const pool = getPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, integration, tmdb_id AS tmdbId, media_type AS mediaType, title, created_at AS createdAt
     FROM scrobble_exclusions WHERE integration = ? AND tmdb_id = ? AND media_type = ?`,
    [integration, tmdbId, mediaType],
  );

  return rows.length > 0 ? (rows[0] as ScrobbleExclusion) : null;
}
