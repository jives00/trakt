import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3306),
      database: process.env.DB_NAME ?? 'trakt',
      user: process.env.DB_USER ?? 'trakt',
      password: process.env.DB_PASSWORD ?? '',
    });
  }
  return pool;
}
