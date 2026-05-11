import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../../.env') });

import { runMigrations } from '../src/test/runMigrations';

const dbConfig = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'trakt',
  password: process.env.DB_PASSWORD ?? '',
};

async function main() {
  await runMigrations('trakt', dbConfig);
  console.log(`✓ Migrated trakt`);

  await runMigrations('trakt_test', dbConfig);
  console.log(`✓ Migrated trakt_test`);
}

main().catch(err => { console.error(err); process.exit(1); });
