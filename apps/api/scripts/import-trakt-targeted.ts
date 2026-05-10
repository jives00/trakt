/**
 * Targeted Trakt.tv import for specific shows.
 * Re-imports watch history for shows that had missing episodes.
 *
 * Usage: pnpm --filter api tsx scripts/import-trakt-targeted.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../../.env') });

import { getPool } from '../src/db';
import { RowDataPacket } from 'mysql2/promise';
import { fetchShow, fetchEpisode } from '../src/services/tmdb-shows.client';

const USER_ID = 1;
const EXPORT_DIR = path.resolve(__dirname, '../../../docs/trakt-export');
const THROTTLE_MS = 333;

// Target shows with missing episodes
const TARGET_SHOWS = [62852, 61222, 66732, 63639]; // Billions, BoJack, Stranger Things, The Expanse

interface TraktHistoryItem {
  id: number;
  watched_at: string;
  action: string;
  type: 'movie' | 'episode';
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

async function collectUniqueSeasonsForTargetShows(): Promise<Map<number, Set<number>>> {
  console.log('\n🔍 Collecting target show seasons from history...');

  const seasonsByShow = new Map<number, Set<number>>();
  const historyFiles = getJsonFiles(/^watched-history-\d+\.json$/);

  for (const file of historyFiles) {
    const items = readJsonFile<TraktHistoryItem>(file);
    for (const item of items) {
      if (item.type === 'episode' && item.episode && item.show && TARGET_SHOWS.includes(item.show.ids.tmdb)) {
        if (!seasonsByShow.has(item.show.ids.tmdb)) {
          seasonsByShow.set(item.show.ids.tmdb, new Set());
        }
        seasonsByShow.get(item.show.ids.tmdb)!.add(item.episode.season);
      }
    }
  }

  console.log(`  ✅ Found ${seasonsByShow.size} target shows with ${[...seasonsByShow.values()].reduce((a, b) => a + b.size, 0)} unique seasons`);
  return seasonsByShow;
}

async function prefetchSeasons(seasonsByShow: Map<number, Set<number>>): Promise<void> {
  console.log('\n📥 Pre-fetching target show seasons...');

  let count = 0;
  let totalSeasons = 0;
  seasonsByShow.forEach(seasons => {
    totalSeasons += seasons.size;
  });

  for (const [showTmdbId, seasons] of seasonsByShow) {
    try {
      await getOrInsertShow(showTmdbId);
      for (const seasonNumber of seasons) {
        await getOrInsertEpisode(showTmdbId, seasonNumber, 1);
        count++;
        if (count % 10 === 0) {
          console.log(`  ${count}/${totalSeasons} seasons fetched`);
        }
        await sleep(THROTTLE_MS);
      }
    } catch (err) {
      console.error(`❌ Error fetching show ${showTmdbId}:`, err);
    }
  }

  console.log(`  ✅ All ${totalSeasons} target seasons pre-fetched`);
}

async function importWatchHistory(): Promise<number> {
  console.log('\n📺 Importing target show watch history...');

  const historyFiles = getJsonFiles(/^watched-history-\d+\.json$/);
  let inserted = 0;
  let skipped = 0;

  for (const file of historyFiles) {
    const items = readJsonFile<TraktHistoryItem>(file);
    for (const item of items) {
      try {
        if (item.type === 'episode' && item.episode && item.show && TARGET_SHOWS.includes(item.show.ids.tmdb)) {
          const episode = await getOrInsertEpisode(
            item.show.ids.tmdb,
            item.episode.season,
            item.episode.number
          );

          const pool = getPool();
          const [result] = await pool.query<any[]>(
            `INSERT IGNORE INTO watch_history (user_id, media_type, media_id, watched_at, source, progress_pct)
             VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=id`,
            [USER_ID, 'episode', episode.id, item.watched_at, 'trakt.tv', 100]
          );

          if (result.affectedRows > 0) inserted++;
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

async function main() {
  console.log('\n🎯 Targeted Trakt.tv Import (4 shows)');
  console.log('═'.repeat(60));

  let exitCode = 0;
  try {
    if (!fs.existsSync(EXPORT_DIR)) {
      console.error(`❌ Export directory not found: ${EXPORT_DIR}`);
      exitCode = 1;
    } else {
      const seasonsByShow = await collectUniqueSeasonsForTargetShows();
      await prefetchSeasons(seasonsByShow);
      await importWatchHistory();

      console.log('\n' + '═'.repeat(60));
      console.log(`✅ Targeted import complete.`);
    }
  } catch (err) {
    console.error('\n❌ Import failed:', err);
    exitCode = 1;
  } finally {
    const pool = getPool();
    await pool.end();
    process.exit(exitCode);
  }
}

main();
