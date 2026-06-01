import { getOrFetchMovie } from './movies.service';
import { getOrFetchShow, getOrFetchEpisode } from './shows.service';
import { checkMovieWatchlistCompletion, checkShowWatchlistCompletion } from './user-media.service';
import { updateNowPlaying, clearNowPlaying, upsertWatchHistory, isScrobbleExcluded, DEFAULT_USER_ID } from './scrobble.service';

const WATCH_THRESHOLD = { movie: 80, episode: 70 };

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
}

interface NuvioEpisodePayload {
  show: { title: string; year?: number; ids: NuvioIds };
  episode: { title?: string; season: number; number: number; ids: NuvioIds };
  progress: number;
  app_version?: string;
}

export type NuvioScrobblePayload = NuvioMoviePayload | NuvioEpisodePayload;

function isEpisodePayload(p: NuvioScrobblePayload): p is NuvioEpisodePayload {
  return 'show' in p && 'episode' in p;
}

export async function handleNuvioScrobble(action: 'start' | 'stop', payload: NuvioScrobblePayload): Promise<void> {
  try {
    const progressPct = Math.round(payload.progress);

    if (isEpisodePayload(payload)) {
      const tmdbId = payload.show.ids.tmdb;
      if (!tmdbId) return;

      const { season, number: episodeNumber } = payload.episode;
      if (season == null || episodeNumber == null) return;

      const isExcluded = await isScrobbleExcluded(tmdbId, 'episode', 'nuvio');

      const show = await getOrFetchShow(tmdbId);
      const episode = await getOrFetchEpisode(tmdbId, season, episodeNumber);

      if (action === 'start') {
        await updateNowPlaying(DEFAULT_USER_ID, 'nuvio', 'episode', episode.episodeId, progressPct);
      } else {
        await clearNowPlaying(DEFAULT_USER_ID);
        if (!isExcluded && progressPct >= WATCH_THRESHOLD.episode) {
          await upsertWatchHistory(DEFAULT_USER_ID, 'nuvio', 'episode', episode.episodeId, progressPct, true);
          void checkShowWatchlistCompletion(DEFAULT_USER_ID, show.id)
            .catch(err => console.error('Watchlist show completion check failed:', err));
        }
      }
    } else {
      const tmdbId = payload.movie.ids.tmdb;
      if (!tmdbId) return;

      const isExcluded = await isScrobbleExcluded(tmdbId, 'movie', 'nuvio');
      const movie = await getOrFetchMovie(tmdbId);

      if (action === 'start') {
        await updateNowPlaying(DEFAULT_USER_ID, 'nuvio', 'movie', movie.id, progressPct);
      } else {
        await clearNowPlaying(DEFAULT_USER_ID);
        if (!isExcluded && progressPct >= WATCH_THRESHOLD.movie) {
          await upsertWatchHistory(DEFAULT_USER_ID, 'nuvio', 'movie', movie.id, progressPct, true);
          void checkMovieWatchlistCompletion(DEFAULT_USER_ID, movie.id)
            .catch(err => console.error('Watchlist movie completion check failed:', err));
        }
      }
    }
  } catch (err) {
    console.error('Error in handleNuvioScrobble:', err);
    throw err;
  }
}
