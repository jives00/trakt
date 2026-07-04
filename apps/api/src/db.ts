import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    let dbName: string;
    const workerId = process.env.VITEST_WORKER_ID;

    if (workerId) {
      const workerNum = (Number(workerId) % 18) + 1; // Map to 1-18
      dbName = `trakt_test_${workerNum}`;
    } else {
      dbName = process.env.DB_NAME ?? 'trakt';
    }

    pool = mysql.createPool({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3306),
      database: dbName,
      user: process.env.DB_USER ?? 'trakt',
      password: process.env.DB_PASSWORD ?? '',
      dateStrings: true,
      timezone: '+00:00',
      connectionLimit: 20,
      waitForConnections: true,
    });
  }
  return pool;
}
