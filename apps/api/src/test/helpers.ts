import { readFileSync } from 'fs';
import { join } from 'path';
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? 'trakt_test',
  user: process.env.DB_USER ?? 'trakt',
  password: process.env.DB_PASSWORD ?? '',
};

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) pool = mysql.createPool(DB_CONFIG);
  return pool;
}

const TABLES = [
  'credits', 'people', 'external_ids', 'scrobble_exclusions',
  'notes', 'ratings', 'list_items', 'lists',
  'watchlist', 'collection', 'watch_history',
  'episodes', 'seasons', 'tv_shows', 'movies',
  'refresh_tokens', 'users',
];

const SEED_SQL = readFileSync(
  join(__dirname, '../../migrations/test-seed.sql'),
  'utf8',
);

export async function resetDb(): Promise<void> {
  const conn = await getPool().getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES) {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    for (const statement of SEED_SQL.split(';').map(s => s.trim()).filter(Boolean)) {
      await conn.query(statement);
    }
  } finally {
    conn.release();
  }
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = null;
}
