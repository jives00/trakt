import mysql from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';
import { config } from 'dotenv';
import { resolve } from 'path';
import { runMigrations } from './runMigrations';

const env = config({ path: resolve(__dirname, '../../.env') }).parsed ?? {};

const NUM_WORKERS = 4;

const ADMIN_DB_CONFIG = {
  host: env.DB_HOST ?? 'localhost',
  port: Number(env.DB_PORT ?? 3306),
  user: env.DB_TEST_ADMIN_USER ?? 'root',
  password: env.DB_TEST_ADMIN_PASSWORD ?? '',
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
  const adminConn = await mysql.createConnection(ADMIN_DB_CONFIG);

  try {
    console.log('Ensuring trakt_test is migrated...');
    await runMigrations('trakt_test', ADMIN_DB_CONFIG);

    for (let i = 1; i <= NUM_WORKERS; i++) {
      const dbName = `trakt_test_${i}`;
      try {
        console.log(`Setting up ${dbName}...`);
        await adminConn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await cloneSchema(adminConn, 'trakt_test', dbName);
        console.log(`✓ ${dbName} ready`);
      } catch (err) {
        console.error(`Failed to set up ${dbName}:`, err);
        throw err;
      }
    }

    console.log('✓ All test databases ready');
  } finally {
    await adminConn.end();
  }
}

export async function teardown(): Promise<void> {
  const adminConn = await mysql.createConnection(ADMIN_DB_CONFIG);

  try {
    for (let i = 1; i <= NUM_WORKERS; i++) {
      const dbName = `trakt_test_${i}`;
      try {
        await adminConn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
      } catch (err) {
        console.error(`Failed to drop ${dbName}:`, err);
      }
    }
    console.log('✓ Test databases cleaned up');
  } finally {
    await adminConn.end();
  }
}
