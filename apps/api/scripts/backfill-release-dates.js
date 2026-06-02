#!/usr/bin/env node
// Standalone backfill — runs inside the trakt-api container with plain `node`.
// No tsx, no project imports. Uses Node 24 native fetch + mysql2 already in node_modules.

const mysql = require('/app/node_modules/mysql2/promise');

const TMDB_KEY = process.env.TMDB_API_KEY;
const DELAY_MS = 250;
const watchlistOnly = process.argv.includes('--watchlist');

if (!TMDB_KEY) { console.error('TMDB_API_KEY not set'); process.exit(1); }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function usDate(releaseDates, type) {
  const d = releaseDates
    ?.find(r => r.iso_3166_1 === 'US')
    ?.release_dates?.find(d => d.type === type)
    ?.release_date?.slice(0, 10);
  return d || null;
}

async function fetchReleaseDates(tmdbId) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}/release_dates?api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} for tmdb_id=${tmdbId}`);
  const data = await res.json();
  return data.results;
}

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST ?? 'mysql',
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME ?? 'trakt',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    timezone: '+00:00',
  });

  const query = watchlistOnly
    ? `SELECT DISTINCT m.id, m.tmdb_id, m.title
       FROM movies m
       JOIN list_items li ON li.media_type = 'movie' AND li.media_id = m.id
       JOIN lists l ON l.id = li.list_id AND l.list_type = 'watchlist'
       WHERE m.digital_release_date IS NULL AND m.physical_release_date IS NULL
       ORDER BY m.id`
    : `SELECT id, tmdb_id, title FROM movies
       WHERE digital_release_date IS NULL AND physical_release_date IS NULL
       ORDER BY id`;

  console.log(`Mode: ${watchlistOnly ? 'watchlist only' : 'all movies'} missing digital/physical dates`);

  const [rows] = await pool.query(query);
  console.log(`Found ${rows.length} movies to refresh\n`);

  let updated = 0, errors = 0;

  for (const row of rows) {
    try {
      const releaseDates = await fetchReleaseDates(row.tmdb_id);
      const digital = usDate(releaseDates, 4);
      const physical = usDate(releaseDates, 5);

      await pool.query(
        'UPDATE movies SET digital_release_date = ?, physical_release_date = ? WHERE id = ?',
        [digital, physical, row.id],
      );

      console.log(`[${updated + errors + 1}/${rows.length}] ${row.title} → digital: ${digital ?? '—'}  physical: ${physical ?? '—'}`);
      updated++;
    } catch (err) {
      console.error(`  ✗ ${row.title} (tmdb_id=${row.tmdb_id}): ${err.message}`);
      errors++;
    }
    await sleep(DELAY_MS);
  }

  await pool.end();
  console.log(`\nDone — ${updated} updated, ${errors} errors`);
}

main().catch(err => { console.error(err); process.exit(1); });
