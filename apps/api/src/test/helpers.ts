import { readFileSync } from 'fs';
import { join } from 'path';
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const workerId = process.env.VITEST_WORKER_ID ?? '1';
    const workerNum = ((Number(workerId) - 1) % 4) + 1; // Map to 1-4
    const dbName = `trakt_test_${workerNum}`;

    const DB_CONFIG = {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3306),
      database: dbName,
      user: process.env.DB_USER ?? 'trakt',
      password: process.env.DB_PASSWORD ?? '',
    };

    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

const TABLES = [
  'credits', 'people', 'external_ids', 'scrobble_exclusions',
  'notes', 'ratings', 'list_items', 'lists', 'watch_history',
  'episodes', 'seasons', 'tv_shows', 'movies',
  'refresh_tokens', 'users', 'trakt_tokens',
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
      await conn.query(`DELETE FROM \`${table}\``);
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
