import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { forceRefreshShowMetadata, getOrFetchSeason } from './shows.service';
import { forceRefreshMovieMetadata } from './movies.service';

const INTERVAL_MS = 24 * 60 * 60 * 1000;
const LOOKAHEAD_DAYS = 90;
const LOOKBACK_DAYS = 14;
const MOVIE_LOOKBACK_DAYS = 30;

const TRACKED_SHOW_IDS = `
  SELECT li.media_id FROM list_items li
  JOIN lists l ON l.id = li.list_id AND l.list_type IN ('watchlist', 'rewatch')
  WHERE li.media_type = 'show' AND li.media_id NOT IN (
    SELECT li2.media_id FROM list_items li2
    JOIN lists l2 ON l2.id = li2.list_id AND l2.list_type = 'dropped'
    WHERE li2.media_type = 'show'
  )`;

async function attempt(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[schedule-refresh] failed ${label}:`, err);
  }
}

async function refreshShows(): Promise<void> {
  const pool = getPool();
  const [shows] = await pool.query<RowDataPacket[]>(
    `SELECT id, tmdb_id AS tmdbId FROM tv_shows
     WHERE id IN (${TRACKED_SHOW_IDS})
       AND (status IS NULL OR status NOT IN ('Ended', 'Canceled'))`,
  );
  console.log(`[schedule-refresh] refreshing ${shows.length} active tracked show(s)`);

  for (const show of shows) {
    let seasonCount = 0;
    await attempt(`show ${show.tmdbId}`, async () => {
      seasonCount = (await forceRefreshShowMetadata(show.tmdbId)).seasonCount ?? 0;
    });

    const [seasons] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT seas.season_number AS seasonNumber
       FROM seasons seas
       JOIN episodes e ON e.season_id = seas.id
       WHERE seas.show_id = ?
         AND (e.air_date IS NULL
              OR e.air_date BETWEEN DATE_SUB(CURDATE(), INTERVAL ? DAY) AND DATE_ADD(CURDATE(), INTERVAL ? DAY))`,
      [show.id, LOOKBACK_DAYS, LOOKAHEAD_DAYS],
    );
    const seasonNumbers = new Set<number>(seasons.map(s => s.seasonNumber));
    if (seasonCount > 0) seasonNumbers.add(seasonCount);

    for (const n of seasonNumbers) {
      await attempt(`show ${show.tmdbId} season ${n}`, async () => {
        await pool.query('UPDATE seasons SET fetched_at = NULL WHERE show_id = ? AND season_number = ?', [show.id, n]);
        await getOrFetchSeason(show.tmdbId, n);
      });
    }
  }
}

async function refreshMovies(): Promise<void> {
  const pool = getPool();
  const [movies] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT m.tmdb_id AS tmdbId FROM movies m
     JOIN list_items li ON li.media_id = m.id AND li.media_type = 'movie'
     JOIN lists l ON l.id = li.list_id AND l.list_type = 'watchlist'
     WHERE m.release_date IS NULL OR m.release_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [MOVIE_LOOKBACK_DAYS],
  );
  console.log(`[schedule-refresh] refreshing ${movies.length} upcoming watchlist movie(s)`);

  for (const movie of movies) {
    await attempt(`movie ${movie.tmdbId}`, () => forceRefreshMovieMetadata(movie.tmdbId));
  }
}

async function refreshSchedule(): Promise<void> {
  console.log('[schedule-refresh] starting');
  await refreshShows();
  await refreshMovies();
  console.log('[schedule-refresh] done');
}

export function startScheduleRefresh(): void {
  const run = () => void refreshSchedule().catch(err => console.error('[schedule-refresh] error:', err));
  setTimeout(() => {
    run();
    setInterval(run, INTERVAL_MS);
  }, 60_000);
}
