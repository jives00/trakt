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

      const show = await getOrFetchShow(tmdbId);
      const episode = await getOrFetchEpisode(tmdbId, season, episodeNumber);

      if (action === 'start') {
        await updateNowPlaying(DEFAULT_USER_ID, 'nuvio', 'episode', episode.episodeId, progressPct, false);
      } else if (!isExcluded && progressPct >= threshold.episode) {
        await clearNowPlaying(DEFAULT_USER_ID);
        await upsertWatchHistory(DEFAULT_USER_ID, 'nuvio', 'episode', episode.episodeId, progressPct, true);
        void checkShowWatchlistCompletion(DEFAULT_USER_ID, show.id)
          .catch(err => console.error('Watchlist show completion check failed:', err));
      } else if (payload.paused) {
        await updateNowPlaying(DEFAULT_USER_ID, 'nuvio', 'episode', episode.episodeId, progressPct, true);
      } else {
        await clearNowPlaying(DEFAULT_USER_ID);
      }
    } else {
      const tmdbId = await resolveTmdbId(payload.movie.ids, 'movie');
      if (!tmdbId) return;

      const isExcluded = await isScrobbleExcluded(tmdbId, 'movie', 'nuvio');
      const movie = await getOrFetchMovie(tmdbId);

      if (action === 'start') {
        await updateNowPlaying(DEFAULT_USER_ID, 'nuvio', 'movie', movie.id, progressPct, false);
      } else if (!isExcluded && progressPct >= threshold.movie) {
        await clearNowPlaying(DEFAULT_USER_ID);
        await upsertWatchHistory(DEFAULT_USER_ID, 'nuvio', 'movie', movie.id, progressPct, true);
        void checkMovieWatchlistCompletion(DEFAULT_USER_ID, movie.id)
          .catch(err => console.error('Watchlist movie completion check failed:', err));
      } else if (payload.paused) {
        await updateNowPlaying(DEFAULT_USER_ID, 'nuvio', 'movie', movie.id, progressPct, true);
      } else {
        await clearNowPlaying(DEFAULT_USER_ID);
      }
    }
  } catch (err) {
    console.error('Error in handleNuvioScrobble:', err);
    throw err;
  }
}
