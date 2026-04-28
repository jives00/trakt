import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../../.env') });

import { readFileSync, readdirSync } from 'fs';
import mysql from 'mysql2/promise';

const migrationsDir = join(__dirname, '../migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') && f !== 'test-seed.sql')
  .sort();

const statements = migrationFiles.flatMap(file => {
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  return sql.split(';').map(s => s.trim()).filter(Boolean);
});

async function migrate(dbName: string) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'trakt',
    password: process.env.DB_PASSWORD ?? '',
    database: dbName,
  });
  for (const statement of statements) {
    await conn.query(statement).catch((err: { errno: number }) => {
      if (err.errno === 1060) return; // duplicate column — already applied
      throw err;
    });
  }
  await conn.end();
  console.log(`✓ Migrated ${dbName}`);
}

async function main() {
  await migrate('trakt');
  await migrate('trakt_test');
}

main().catch(err => { console.error(err); process.exit(1); });
