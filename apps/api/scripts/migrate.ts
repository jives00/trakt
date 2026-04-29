import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../../.env') });

import { readFileSync, readdirSync } from 'fs';
import mysql from 'mysql2/promise';

const migrationsDir = join(__dirname, '../migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') && f !== 'test-seed.sql')
  .sort();

async function migrate(dbName: string) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'trakt',
    password: process.env.DB_PASSWORD ?? '',
    database: dbName,
    multipleStatements: true,
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT name FROM migrations');
  const applied = new Set(rows.map((r) => r.name as string));

  for (const file of migrationFiles) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    await conn.query('INSERT INTO migrations (name) VALUES (?)', [file]);
    console.log(`  applied: ${file}`);
  }

  await conn.end();
  console.log(`✓ Migrated ${dbName}`);
}

async function main() {
  await migrate('trakt');
  await migrate('trakt_test');
}

main().catch(err => { console.error(err); process.exit(1); });
