import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../../.env') });

import mysql from 'mysql2/promise';
import { transformMovie } from '../src/services/tmdb-movies.client';
import { get } from '../src/services/tmdb.client';

const DELAY_MS = 250; // stay well under TMDB's 40 req/s limit
const watchlistOnly = process.argv.includes('--watchlist');

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    database: 'trakt',
    user: process.env.DB_USER ?? 'trakt',
    password: process.env.DB_PASSWORD ?? '',
    timezone: '+00:00',
  });

  let query: string;
  if (watchlistOnly) {
    query = `
      SELECT DISTINCT m.id, m.tmdb_id
      FROM movies m
      JOIN list_items li ON li.media_type = 'movie' AND li.media_id = m.id
      JOIN lists l ON l.id = li.list_id AND l.list_type = 'watchlist'
      WHERE m.digital_release_date IS NULL AND m.physical_release_date IS NULL
      ORDER BY m.id`;
    console.log('Mode: watchlist items only (missing digital/physical dates)');
  } else {
    query = `
      SELECT id, tmdb_id FROM movies
      WHERE digital_release_date IS NULL AND physical_release_date IS NULL
      ORDER BY id`;
    console.log('Mode: all movies missing digital/physical dates');
  }

  const [rows] = await pool.query<any[]>(query);
  console.log(`Found ${rows.length} movies to refresh\n`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const raw = await get<Record<string, any>>(`/movie/${row.tmdb_id}`, {
        append_to_response: 'release_dates',
      });
      const movie = transformMovie(raw);

      await pool.query(
        `UPDATE movies
         SET digital_release_date = ?, physical_release_date = ?
         WHERE id = ?`,
        [movie.digitalReleaseDate ?? null, movie.physicalReleaseDate ?? null, row.id],
      );

      const d = movie.digitalReleaseDate ?? '—';
      const p = movie.physicalReleaseDate ?? '—';
      console.log(`[${updated + skipped + 1}/${rows.length}] ${raw['title']} → digital: ${d}  physical: ${p}`);
      updated++;
    } catch (err: any) {
      console.error(`  ✗ tmdb_id=${row.tmdb_id}: ${err.message}`);
      skipped++;
    }

    await sleep(DELAY_MS);
  }

  await pool.end();
  console.log(`\nDone — ${updated} updated, ${skipped} errors`);
}

main().catch((err) => { console.error(err); process.exit(1); });
