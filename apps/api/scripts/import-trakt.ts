/**
 * Import Trakt.tv data from a local export.
 * Parses JSON files from docs/trakt-export/, pre-fetches TMDB episodes,
 * then inserts into the app database with deduplication.
 *
 * Usage: pnpm --filter api import:trakt
 *
 * Before running:
 * 1. Export data from https://trakt.tv/settings/data-export
 * 2. Extract zip to docs/trakt-export/
 * 3. Run pre-import data clear (see code below or plan)
 */

import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';

// Load .env from repo root before any other imports that need it
config({ path: path.resolve(__dirname, '../../../.env') });

import { getPool } from '../src/db';
import { RowDataPacket } from 'mysql2/promise';

// Direct TMDB fetchers that bypass the backfill process
import { fetchMovie } from '../src/services/tmdb-movies.client';
import { fetchShow, fetchEpisode } from '../src/services/tmdb-shows.client';

const USER_ID = 1; // Single-user app
const EXPORT_DIR = path.resolve(__dirname, '../../../docs/trakt-export');
const THROTTLE_MS = 333; // ~3 req/s for TMDB

// Direct database accessors (skip backfill logic that triggers OMDB API calls)
async function getOrInsertMovie(tmdbId: number) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM movies WHERE tmdb_id = ?', [tmdbId]);
  if (rows.length > 0) return { id: (rows[0] as any).id };

  const movieData = await fetchMovie(tmdbId);
  await pool.query(
    `INSERT INTO movies (tmdb_id, title, year, overview, poster_path, backdrop_path, runtime_min, genres,
                        origin_country, original_language, production_company, tagline, release_date, tmdb_rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title)`,
    [tmdbId, movieData.title, movieData.year || null, movieData.overview,
     movieData.posterPath, movieData.backdropPath, movieData.runtimeMin,
     JSON.stringify(movieData.genres), movieData.originCountry ?? null, movieData.originalLanguage ?? null,
     movieData.productionCompany ?? null, movieData.tagline ?? null, movieData.releaseDate ?? null, movieData.tmdbRating ?? null],
  );
  const [inserted] = await pool.query<RowDataPacket[]>('SELECT id FROM movies WHERE tmdb_id = ?', [tmdbId]);
  return { id: (inserted[0] as any).id };
}

async function getOrInsertShow(tmdbId: number) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM tv_shows WHERE tmdb_id = ?', [tmdbId]);
  if (rows.length > 0) return { id: (rows[0] as any).id };

  const showData = await fetchShow(tmdbId);
  await pool.query(
    `INSERT INTO tv_shows (tmdb_id, title, year, overview, poster_path, backdrop_path, first_air_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title)`,
    [tmdbId, showData.title, showData.year || null, showData.overview,
     showData.posterPath, showData.backdropPath, showData.firstAirDate ?? null],
  );
  const [inserted] = await pool.query<RowDataPacket[]>('SELECT id FROM tv_shows WHERE tmdb_id = ?', [tmdbId]);
  return { id: (inserted[0] as any).id };
}

async function getOrInsertEpisode(showTmdbId: number, season: number, episodeNum: number) {
  const pool = getPool();
  const [showRows] = await pool.query<RowDataPacket[]>('SELECT id FROM tv_shows WHERE tmdb_id = ?', [showTmdbId]);
  if (!showRows.length) throw new Error(`Show ${showTmdbId} not found`);
  const showId = (showRows[0] as any).id;

  // Get or create season
  const [seasonRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM seasons WHERE show_id = ? AND season_number = ?',
    [showId, season]
  );

  let seasonId: number;
  if (seasonRows.length > 0) {
    seasonId = (seasonRows[0] as any).id;
  } else {
    const episodeData = await fetchEpisode(showTmdbId, season, episodeNum);
    await pool.query(
      'INSERT INTO seasons (show_id, season_number) VALUES (?, ?)',
      [showId, season]
    );
    const [insertedSeason] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM seasons WHERE show_id = ? AND season_number = ?',
      [showId, season]
    );
    seasonId = (insertedSeason[0] as any).id;
  }

  const [episodeRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM episodes WHERE show_id = ? AND season_id = ? AND episode_number = ?',
    [showId, seasonId, episodeNum]
  );
  if (episodeRows.length > 0) return { id: (episodeRows[0] as any).id };

  const episodeData = await fetchEpisode(showTmdbId, season, episodeNum);
  await pool.query(
    `INSERT INTO episodes (show_id, season_id, episode_number, title, overview, still_path, runtime_min, air_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [showId, seasonId, episodeNum, episodeData.title, episodeData.overview,
     episodeData.stillPath, episodeData.runtimeMin, episodeData.airDate ?? null],
  );
  const [inserted] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM episodes WHERE show_id = ? AND season_id = ? AND episode_number = ?',
    [showId, seasonId, episodeNum]
  );
  return { id: (inserted[0] as any).id };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface TraktHistoryItem {
  id: number;
  watched_at: string;
  action: string;
  type: 'movie' | 'episode';
  movie?: {
    title: string;
    year: number;
    ids: { tmdb: number };
  };
  episode?: {
    season: number;
    number: number;
    title: string;
    ids: { tmdb: number };
  };
  show?: {
    title: string;
    year: number;
    ids: { tmdb: number };
  };
}

interface TraktRating {
  rated_at: string;
  rating: number;
  type: 'movie' | 'show' | 'episode';
  movie?: {
    title: string;
    year: number;
    ids: { tmdb: number };
  };
  show?: {
    title: string;
    year: number;
    ids: { tmdb: number };
  };
  episode?: {
    season: number;
    number: number;
    ids: { tmdb: number };
  };
}

interface TraktWatchlistItem {
  type: 'movie' | 'show';
  rank: number;
  listed_at: string;
  movie?: {
    ids: { tmdb: number };
  };
  show?: {
    ids: { tmdb: number };
  };
}

interface TraktCollection {
  type: 'movie' | 'show';
  collected_at: string;
  movie?: {
    ids: { tmdb: number };
  };
  show?: {
    ids: { tmdb: number };
  };
  seasons?: Array<{
    number: number;
    episodes: Array<{ number: number; collected_at: string }>;
  }>;
}

interface TraktList {
  ids: { slug: string };
  name: string;
  description: string;
  privacy: 'private' | 'public';
  created_at: string;
  sort_by: string;
  sort_how: string;
}

interface TraktListItem {
  type: 'movie' | 'show' | 'episode';
  rank: number;
  listed_at: string;
  movie?: {
    ids: { tmdb: number };
  };
  show?: {
    ids: { tmdb: number };
  };
  episode?: {
    season: number;
    number: number;
    ids: { tmdb: number };
  };
}

// ── Utility functions ────────────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readJsonFile<T>(filePath: string): T[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T[];
  } catch (err) {
    console.warn(`⚠️  Failed to read ${path.basename(filePath)}:`, err);
    return [];
  }
}

function getJsonFiles(pattern: RegExp): string[] {
  const files = fs.readdirSync(EXPORT_DIR);
  return files
    .filter(f => pattern.test(f))
    .map(f => path.join(EXPORT_DIR, f))
    .sort();
}

// ── Deduplication queries ────────────────────────────────────────────────────

async function executeInsertIgnore(sql: string, values: unknown[]): Promise<number> {
  const pool = getPool();
  const [result] = await pool.query(sql, values);
  return (result as any).affectedRows ?? 0;
}

// ── Import phases ────────────────────────────────────────────────────────────

async function collectUniqueSeasonsFromHistory(): Promise<Map<number, Set<number>>> {
  console.log('\n📊 Collecting unique seasons from history...');
  const seasonsByShow = new Map<number, Set<number>>();

  const historyFiles = getJsonFiles(/^watched-history-\d+\.json$/);
  let totalItems = 0;

  for (const file of historyFiles) {
    const items = readJsonFile<TraktHistoryItem>(file);
    for (const item of items) {
      if (item.type === 'episode' && item.show && item.episode) {
        const showTmdbId = item.show.ids.tmdb;
        const season = item.episode.season;

        if (!seasonsByShow.has(showTmdbId)) {
          seasonsByShow.set(showTmdbId, new Set());
        }
        seasonsByShow.get(showTmdbId)!.add(season);
        totalItems++;
      }
    }
  }

  console.log(`  ${totalItems} episodes across ${seasonsByShow.size} shows`);
  let totalSeasons = 0;
  seasonsByShow.forEach(seasons => {
    totalSeasons += seasons.size;
  });
  console.log(`  ${totalSeasons} unique (show, season) pairs to pre-fetch`);

  return seasonsByShow;
}

async function prefetchTmdbSeasons(seasonsByShow: Map<number, Set<number>>): Promise<void> {
  console.log('\n📥 Pre-fetching TMDB seasons...');

  let count = 0;
  let totalSeasons = 0;
  seasonsByShow.forEach(seasons => {
    totalSeasons += seasons.size;
  });

  for (const [showTmdbId, seasons] of seasonsByShow) {
    try {
      // Fetch show first to populate show in DB
      await getOrInsertShow(showTmdbId);

      // Fetch each season
      for (const seasonNumber of seasons) {
        // This populates the episodes table with tmdb_id
        await getOrInsertEpisode(showTmdbId, seasonNumber, 1);
        count++;
        if (count % 50 === 0) {
          console.log(`  ${count}/${totalSeasons} seasons fetched`);
        }
        await sleep(THROTTLE_MS);
      }
    } catch (err) {
      console.error(`❌ Error fetching show ${showTmdbId}:`, err);
    }
  }

  console.log(`  ✅ All ${totalSeasons} seasons pre-fetched`);
}

async function importWatchHistory(): Promise<number> {
  console.log('\n📺 Importing watch history...');

  const historyFiles = getJsonFiles(/^watched-history-\d+\.json$/);
  let inserted = 0;
  let skipped = 0;

  for (const file of historyFiles) {
    const items = readJsonFile<TraktHistoryItem>(file);

    for (const item of items) {
      try {
        if (item.type === 'movie' && item.movie) {
          // Movie history
          const movie = await getOrInsertMovie(item.movie.ids.tmdb);

          const sql = `
            INSERT IGNORE INTO watch_history
              (user_id, media_type, media_id, watched_at, progress_pct, source)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          const affected = await executeInsertIgnore(sql, [
            USER_ID,
            'movie',
            movie.id,
            item.watched_at,
            100, // Trakt doesn't provide progress for imported history
            'trakt.tv',
          ]);
          if (affected > 0) inserted++;
          else skipped++;
        } else if (item.type === 'episode' && item.show && item.episode) {
          // Episode history
          const episode = await getOrInsertEpisode(
            item.show.ids.tmdb,
            item.episode.season,
            item.episode.number
          );

          const sql = `
            INSERT IGNORE INTO watch_history
              (user_id, media_type, media_id, watched_at, progress_pct, source)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          const affected = await executeInsertIgnore(sql, [
            USER_ID,
            'episode',
            episode.episodeId,
            item.watched_at,
            100,
            'trakt.tv',
          ]);
          if (affected > 0) inserted++;
          else skipped++;
        }
      } catch (err) {
        console.warn(`  ⚠️  Failed to import history item ${item.id}:`, err);
      }
    }
  }

  console.log(`  ✅ Inserted ${inserted}, skipped ${skipped} (duplicates)`);
  return inserted;
}

async function importRatings(): Promise<number> {
  console.log('\n⭐ Importing ratings...');

  let inserted = 0;
  let skipped = 0;

  // Movies
  const movieRatings = readJsonFile<TraktRating>(path.join(EXPORT_DIR, 'ratings-movies.json'));
  for (const rating of movieRatings) {
    try {
      const movie = await getOrInsertMovie(rating.movie!.ids.tmdb);

      const sql = `
        INSERT IGNORE INTO ratings
          (user_id, media_type, media_id, rating, rated_at)
        VALUES (?, ?, ?, ?, ?)
      `;
      const affected = await executeInsertIgnore(sql, [
        USER_ID,
        'movie',
        movie.id,
        rating.rating,
        rating.rated_at,
      ]);
      if (affected > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.warn(`  ⚠️  Failed to import movie rating:`, err);
    }
  }

  // Shows
  const showRatings = readJsonFile<TraktRating>(path.join(EXPORT_DIR, 'ratings-shows.json'));
  for (const rating of showRatings) {
    try {
      const show = await getOrInsertShow(rating.show!.ids.tmdb);

      const sql = `
        INSERT IGNORE INTO ratings
          (user_id, media_type, media_id, rating, rated_at)
        VALUES (?, ?, ?, ?, ?)
      `;
      const affected = await executeInsertIgnore(sql, [
        USER_ID,
        'show',
        show.id,
        rating.rating,
        rating.rated_at,
      ]);
      if (affected > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.warn(`  ⚠️  Failed to import show rating:`, err);
    }
  }

  // Episodes (skipped per plan)
  const episodeRatings = readJsonFile<TraktRating>(
    path.join(EXPORT_DIR, 'ratings-episodes.json')
  );
  if (episodeRatings.length > 0) {
    console.log(`  ℹ️  Skipping ${episodeRatings.length} episode ratings (not in scope)`);
  }

  console.log(`  ✅ Inserted ${inserted}, skipped ${skipped} (duplicates)`);
  return inserted;
}

async function importWatchlist(): Promise<number> {
  console.log('\n📋 Importing watchlist...');

  const items = readJsonFile<TraktWatchlistItem>(path.join(EXPORT_DIR, 'lists-watchlist.json'));
  let inserted = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      if (item.type === 'movie' && item.movie) {
        const movie = await getOrInsertMovie(item.movie.ids.tmdb);

        const sql = `
          INSERT IGNORE INTO watchlist
            (user_id, media_type, media_id, added_at, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `;
        const affected = await executeInsertIgnore(sql, [
          USER_ID,
          'movie',
          movie.id,
          item.listed_at,
          item.rank,
        ]);
        if (affected > 0) inserted++;
        else skipped++;
      } else if (item.type === 'show' && item.show) {
        const show = await getOrInsertShow(item.show.ids.tmdb);

        const sql = `
          INSERT IGNORE INTO watchlist
            (user_id, media_type, media_id, added_at, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `;
        const affected = await executeInsertIgnore(sql, [
          USER_ID,
          'show',
          show.id,
          item.listed_at,
          item.rank,
        ]);
        if (affected > 0) inserted++;
        else skipped++;
      }
    } catch (err) {
      console.warn(`  ⚠️  Failed to import watchlist item:`, err);
    }
  }

  console.log(`  ✅ Inserted ${inserted}, skipped ${skipped} (duplicates)`);
  return inserted;
}

async function importCollection(): Promise<number> {
  console.log('\n🎬 Importing collection...');

  let inserted = 0;
  let skipped = 0;

  // Movies
  const movies = readJsonFile<TraktCollection>(path.join(EXPORT_DIR, 'collection-movies.json'));
  for (const item of movies) {
    try {
      const movie = await getOrInsertMovie(item.movie!.ids.tmdb);

      const sql = `
        INSERT IGNORE INTO collection
          (user_id, media_type, media_id, added_at)
        VALUES (?, ?, ?, ?)
      `;
      const affected = await executeInsertIgnore(sql, [
        USER_ID,
        'movie',
        movie.id,
        item.collected_at,
      ]);
      if (affected > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.warn(`  ⚠️  Failed to import movie collection:`, err);
    }
  }

  // Shows (take show-level, ignore per-episode detail)
  const shows = readJsonFile<TraktCollection>(path.join(EXPORT_DIR, 'collection-shows.json'));
  for (const item of shows) {
    try {
      const show = await getOrInsertShow(item.show!.ids.tmdb);

      const sql = `
        INSERT IGNORE INTO collection
          (user_id, media_type, media_id, added_at)
        VALUES (?, ?, ?, ?)
      `;
      const affected = await executeInsertIgnore(sql, [
        USER_ID,
        'show',
        show.id,
        item.collected_at,
      ]);
      if (affected > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.warn(`  ⚠️  Failed to import show collection:`, err);
    }
  }

  console.log(`  ✅ Inserted ${inserted}, skipped ${skipped} (duplicates)`);
  return inserted;
}

async function importLists(): Promise<number> {
  console.log('\n📚 Importing lists...');

  const listFiles = fs.readdirSync(EXPORT_DIR).filter(f => f.startsWith('lists-list-'));
  const lists = readJsonFile<TraktList>(path.join(EXPORT_DIR, 'lists-lists.json'));

  let inserted = 0;
  let skipped = 0;

  const listIdMap = new Map<string, number>(); // trakt slug → DB id

  // Create lists first
  for (const list of lists) {
    try {
      const sql = `
        INSERT IGNORE INTO lists
          (user_id, name, description, privacy, created_at, sort_by, sort_how)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const pool = getPool();
      const [result] = await pool.query(sql, [
        USER_ID,
        list.name,
        list.description || null,
        list.privacy,
        list.created_at,
        list.sort_by,
        list.sort_how,
      ]);

      const insertId = (result as any).insertId;
      if (insertId) {
        listIdMap.set(list.ids.slug, insertId);
        inserted++;
      } else {
        // List already exists, query for its ID
        const [rows] = await pool.query('SELECT id FROM lists WHERE user_id = ? AND name = ?', [
          USER_ID,
          list.name,
        ]);
        if ((rows as any[]).length > 0) {
          listIdMap.set(list.ids.slug, (rows as any[])[0].id);
          skipped++;
        }
      }
    } catch (err) {
      console.warn(`  ⚠️  Failed to import list ${list.name}:`, err);
    }
  }

  console.log(`  ✅ Lists: inserted ${inserted}, skipped ${skipped} (duplicates)`);

  // Insert list items
  let itemsInserted = 0;
  let itemsSkipped = 0;

  for (const file of listFiles) {
    // Extract slug from filename e.g., "lists-list-1084382-alpacas.json" → "alpacas"
    const match = file.match(/lists-list-\d+-(.+)\.json$/);
    if (!match) continue;

    const slug = match[1];
    const listId = listIdMap.get(slug);
    if (!listId) continue;

    const items = readJsonFile<TraktListItem>(path.join(EXPORT_DIR, file));

    for (const item of items) {
      try {
        let mediaType: 'movie' | 'show' | 'episode' = item.type as any;
        let mediaId: number | null = null;

        if (item.type === 'movie' && item.movie) {
          const movie = await getOrInsertMovie(item.movie.ids.tmdb);
          mediaId = movie.id;
        } else if (item.type === 'show' && item.show) {
          const show = await getOrInsertShow(item.show.ids.tmdb);
          mediaId = show.id;
        } else if (item.type === 'episode' && item.episode && item.show) {
          const episode = await getOrInsertEpisode(
            item.show.ids.tmdb,
            item.episode.season,
            item.episode.number
          );
          mediaId = episode.episodeId;
        }

        if (mediaId) {
          const sql = `
            INSERT IGNORE INTO list_items
              (list_id, media_type, media_id, added_at, sort_order)
            VALUES (?, ?, ?, ?, ?)
          `;
          const affected = await executeInsertIgnore(sql, [
            listId,
            mediaType,
            mediaId,
            item.listed_at,
            item.rank,
          ]);
          if (affected > 0) itemsInserted++;
          else itemsSkipped++;
        }
      } catch (err) {
        console.warn(`  ⚠️  Failed to import list item:`, err);
      }
    }
  }

  console.log(`  ✅ List items: inserted ${itemsInserted}, skipped ${itemsSkipped}`);
  return inserted + itemsInserted;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Trakt.tv Import Script');
  console.log('═'.repeat(60));

  let exitCode = 0;
  try {
    // Verify export directory exists
    if (!fs.existsSync(EXPORT_DIR)) {
      console.error(`❌ Export directory not found: ${EXPORT_DIR}`);
      console.error('   Please extract the Trakt export zip to docs/trakt-export/');
      exitCode = 1;
    } else {
      // Pre-fetch TMDB seasons
      const seasonsByShow = await collectUniqueSeasonsFromHistory();
      await prefetchTmdbSeasons(seasonsByShow);

      // Import all data
      let totalInserted = 0;

      totalInserted += await importWatchHistory();
      totalInserted += await importRatings();
      totalInserted += await importWatchlist();
      totalInserted += await importCollection();
      totalInserted += await importLists();

      console.log('\n' + '═'.repeat(60));
      console.log(`✅ Import complete. ${totalInserted} rows inserted.`);
      console.log(
        '\n💡 Next steps:'
      );
      console.log('   1. Verify the dashboard displays correct totals');
      console.log('   2. Spot-check /history against your Trakt profile');
      console.log('   3. Re-run the script to confirm deduplication (should insert 0 rows)');
    }
  } catch (err) {
    console.error('\n❌ Import failed:', err);
    exitCode = 1;
  } finally {
    // Close database connections before exiting
    const pool = getPool();
    await pool.end();
    process.exit(exitCode);
  }
}

main();
