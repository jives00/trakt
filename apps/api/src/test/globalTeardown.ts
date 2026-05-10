import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { resolve } from 'path';

const env = config({ path: resolve(__dirname, '../../.env') }).parsed ?? {};

const DB_CONFIG = {
  host: env.DB_HOST ?? 'localhost',
  port: Number(env.DB_PORT ?? 3306),
  user: env.DB_TEST_ADMIN_USER ?? 'trakt_test_admin',
  password: env.DB_TEST_ADMIN_PASSWORD ?? '',
};

export async function teardown(): Promise<void> {
  const adminConn = await mysql.createConnection(DB_CONFIG);

  try {
    const NUM_WORKERS = 18;
    // Clean up test databases created during setup
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
