import mysql from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';
import { runMigrations } from './runMigrations';

const NUM_WORKERS = 18;
const DB_CONFIG = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'trakt',
  password: process.env.DB_PASSWORD ?? '',
};

async function getTables(conn: mysql.Connection, dbName: string): Promise<string[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
    [dbName],
  );
  return rows.map(row => row.TABLE_NAME as string);
}

async function cloneSchema(adminConn: mysql.Connection, sourceDb: string, targetDb: string): Promise<void> {
  const tables = await getTables(adminConn, sourceDb);

  for (const table of tables) {
    try {
      await adminConn.query(
        `CREATE TABLE \`${targetDb}\`.\`${table}\` LIKE \`${sourceDb}\`.\`${table}\``
      );
      // Copy data for migrations table so schema changes are tracked
      if (table === 'migrations') {
        await adminConn.query(
          `INSERT INTO \`${targetDb}\`.\`migrations\` SELECT * FROM \`${sourceDb}\`.\`migrations\``
        );
      }
    } catch (err: any) {
      if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
        throw err;
      }
    }
  }
}

export async function setup(): Promise<void> {
  const adminConn = await mysql.createConnection(DB_CONFIG);

  try {
    // Ensure trakt_test is migrated first (template database)
    console.log('Ensuring trakt_test is migrated...');
    await runMigrations('trakt_test', DB_CONFIG);

    // Clone schema from fully-migrated trakt_test to each worker database
    for (let i = 1; i <= NUM_WORKERS; i++) {
      const dbName = `trakt_test_${i}`;
      try {
        console.log(`Setting up ${dbName}...`);
        await adminConn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await cloneSchema(adminConn, 'trakt_test', dbName);
        console.log(`✓ ${dbName} ready with cloned migrated schema`);
      } catch (err) {
        console.error(`Failed to set up ${dbName}:`, err);
        throw err;
      }
    }

    console.log('✓ All test databases ready with migrated schema');
  } finally {
    await adminConn.end();
  }
}

export async function teardown(): Promise<void> {
  // No cleanup needed
}
