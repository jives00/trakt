import { getOrFetchMovie } from './movies.service';
import { getOrFetchShow, getOrFetchEpisode } from './shows.service';
import { checkMovieWatchlistCompletion, checkShowWatchlistCompletion } from './user-media.service';
import { updateNowPlaying, clearNowPlaying, upsertWatchHistory, isScrobbleExcluded, DEFAULT_USER_ID, getWatchThreshold } from './scrobble.service';
import { getPool } from '../db';
import { get as tmdbGet } from './tmdb.client';

interface NuvioIds {
  trakt?: number;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
}

interface NuvioMoviePayload {
  movie: { title: string; year?: number; ids: NuvioIds };
  progress: number;
  app_version?: string;
  paused?: boolean;
}

interface NuvioEpisodePayload {
  show: { title: string; year?: number; ids: NuvioIds };
  episode: { title?: string; season: number; number: number; ids: NuvioIds };
  progress: number;
  app_version?: string;
  paused?: boolean;
}

export type NuvioScrobblePayload = NuvioMoviePayload | NuvioEpisodePayload;

function isEpisodePayload(p: NuvioScrobblePayload): p is NuvioEpisodePayload {
  return 'show' in p && 'episode' in p;
}

async function resolveTmdbId(ids: NuvioIds, mediaType: 'movie' | 'show'): Promise<number | null> {
  if (ids.tmdb) return ids.tmdb;
  if (!ids.imdb) return null;

  const pool = getPool();
  const table = mediaType === 'movie' ? 'movies' : 'tv_shows';
  const [rows] = await pool.query<any[]>(
    `SELECT t.tmdb_id FROM ${table} t
     JOIN external_ids e ON e.media_type = ? AND e.media_id = t.id AND e.source = 'imdb'
     WHERE e.external_id = ? LIMIT 1`,
    [mediaType === 'movie' ? 'movie' : 'show', ids.imdb]
  );
  if (rows.length > 0) return rows[0].tmdb_id as number;

  const data = await tmdbGet<any>(`/find/${ids.imdb}?external_source=imdb_id`);
  const results = mediaType === 'movie' ? data.movie_results : data.tv_results;
  return results?.[0]?.id ?? null;
}

// Local-first id resolution. A scrobble only needs the DB row id, and metadata for
// anything already in the library is already stored — so skip the get-or-fetch path
// when we can, and a TMDB outage stops costing us the session.
async function findLocalEpisode(showTmdbId: number, season: number, episodeNumber: number): Promise<{ episodeId: number; showId: number } | null> {
  const pool = getPool();
  const [rows] = await pool.query<any[]>(
    `SELECT e.id AS episodeId, s.id AS showId
     FROM tv_shows s
     JOIN seasons se ON se.show_id = s.id AND se.season_number = ?
     JOIN episodes e ON e.season_id = se.id AND e.episode_number = ?
     WHERE s.tmdb_id = ? LIMIT 1`,
    [season, episodeNumber, showTmdbId]
  );
  return rows[0] ?? null;
}

async function findLocalMovie(tmdbId: number): Promise<number | null> {
  const pool = getPool();
  const [rows] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = ? LIMIT 1', [tmdbId]);
  return rows[0]?.id ?? null;
}

export async function handleNuvioScrobble(action: 'start' | 'stop', payload: NuvioScrobblePayload): Promise<void> {
  try {
    const progressPct = Math.round(payload.progress);
    const threshold = await getWatchThreshold(DEFAULT_USER_ID);

    if (isEpisodePayload(payload)) {
      const tmdbId = await resolveTmdbId(payload.show.ids, 'show');
      if (!tmdbId) return;

      const { season, number: episodeNumber } = payload.episode;
      if (season == null || episodeNumber == null) return;

      const isExcluded = await isScrobbleExcluded(tmdbId, 'episode', 'nuvio');

      let resolved = await findLocalEpisode(tmdbId, season, episodeNumber);
      if (!resolved) {
        const show = await getOrFetchShow(tmdbId);
        const episode = await getOrFetchEpisode(tmdbId, season, episodeNumber);
        resolved = { episodeId: episode.episodeId, showId: show.id };
      }
      const { episodeId, showId } = resolved;

      if (action === 'start') {
        await updateNowPlaying(DEFAULT_USER_ID, 'nuvio', 'episode', episodeId, progressPct, false);
      } else if (payload.paused) {
        // A pause is never a completion, even past the watch threshold. The client
        // sends paused:true only for genuine user pauses and seek restarts; real
        // stops (playback end, stream switch, player exit) send paused:false.
        await updateNowPlaying(DEFAULT_USER_ID, 'nuvio', 'episode', episodeId, progressPct, true);
      } else if (!isExcluded && progressPct >= threshold.episode) {
        await clearNowPlaying(DEFAULT_USER_ID);
        await upsertWatchHistory(DEFAULT_USER_ID, 'nuvio', 'episode', episodeId, progressPct, true);
        void checkShowWatchlistCompletion(DEFAULT_USER_ID, showId)
          .catch(err => console.error('Watchlist show completion check failed:', err));
      } else {
        await clearNowPlaying(DEFAULT_USER_ID);
      }
    } else {
      const tmdbId = await resolveTmdbId(payload.movie.ids, 'movie');
      if (!tmdbId) return;

      const isExcluded = await isScrobbleExcluded(tmdbId, 'movie', 'nuvio');
      const movieId = (await findLocalMovie(tmdbId)) ?? (await getOrFetchMovie(tmdbId)).id;

      if (action === 'start') {
        await updateNowPlaying(DEFAULT_USER_ID, 'nuvio', 'movie', movieId, progressPct, false);
      } else if (payload.paused) {
        // See the episode branch: a pause never completes, regardless of progress.
        await updateNowPlaying(DEFAULT_USER_ID, 'nuvio', 'movie', movieId, progressPct, true);
      } else if (!isExcluded && progressPct >= threshold.movie) {
        await clearNowPlaying(DEFAULT_USER_ID);
        await upsertWatchHistory(DEFAULT_USER_ID, 'nuvio', 'movie', movieId, progressPct, true);
        void checkMovieWatchlistCompletion(DEFAULT_USER_ID, movieId)
          .catch(err => console.error('Watchlist movie completion check failed:', err));
      } else {
        await clearNowPlaying(DEFAULT_USER_ID);
      }
    }
  } catch (err) {
    console.error('Error in handleNuvioScrobble:', err);
    throw err;
  }
}
