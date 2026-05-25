import https from 'https';
import { getPool } from '../db';
import { isScrobbleExcluded, upsertWatchHistory, updateNowPlaying, clearNowPlaying, DEFAULT_USER_ID } from './scrobble.service';
import { getOrFetchMovie } from './movies.service';
import { getOrFetchShow, getOrFetchEpisode } from './shows.service';
import { checkMovieWatchlistCompletion, checkShowWatchlistCompletion } from './user-media.service';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  username?: string;
}

const TRAKT_API = 'https://api.trakt.tv';
const WATCH_THRESHOLD = { movie: 80, episode: 70 };
const INITIAL_DELAY = process.env.POLL_INITIAL_DELAY ? parseInt(process.env.POLL_INITIAL_DELAY, 10) : 30000; // 30s
const POLL_INTERVAL = process.env.POLL_INTERVAL ? parseInt(process.env.POLL_INTERVAL, 10) : 60000; // 60s
const SAFETY_TIMEOUT = process.env.POLL_SAFETY_TIMEOUT ? parseInt(process.env.POLL_SAFETY_TIMEOUT, 10) : 4 * 60 * 60 * 1000; // 4h

let pollers: Map<string, NodeJS.Timeout> = new Map();
let backgroundPoller: NodeJS.Timeout | null = null;
let lastHistorySync = 0;

export async function getTraktToken(): Promise<StoredToken | null> {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT access_token, refresh_token, expires_at, username FROM trakt_tokens WHERE id = 1'
  );

  if ((rows as any[]).length === 0) {
    return null;
  }

  const row = (rows as any[])[0];
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: new Date(row.expires_at),
    username: row.username,
  };
}

export async function setTraktToken(token: StoredToken): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO trakt_tokens (id, access_token, refresh_token, expires_at, username)
     VALUES (1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
     access_token = VALUES(access_token),
     refresh_token = VALUES(refresh_token),
     expires_at = VALUES(expires_at),
     username = VALUES(username)`,
    [token.accessToken, token.refreshToken, token.expiresAt, token.username || null]
  );
}

export async function refreshTraktToken(): Promise<StoredToken> {
  const token = await getTraktToken();
  if (!token) {
    throw new Error('No refresh token stored');
  }

  const res = await fetch(`${TRAKT_API}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'TraktClone/1.0 (+https://github.com/)',
    },
    body: JSON.stringify({
      client_id: process.env.TRAKT_CLIENT_ID,
      client_secret: process.env.TRAKT_CLIENT_SECRET,
      refresh_token: token.refreshToken,
      grant_type: 'refresh_token',
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh Trakt token: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const newToken: StoredToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    username: token.username,
  };

  await setTraktToken(newToken);
  console.log('🔐 Trakt token refreshed successfully');
  return newToken;
}

async function syncWatchHistory(): Promise<void> {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  // Only sync once per hour
  if (now - lastHistorySync < ONE_HOUR) {
    return;
  }

  lastHistorySync = now;

  let token = await getTraktToken();
  if (!token?.username) return;

  if (token.expiresAt < new Date()) {
    try {
      token = await refreshTraktToken();
    } catch {
      return;
    }
  }

  if (!process.env.TRAKT_CLIENT_ID) return;

  const username = token.username;

  try {
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const options = {
        hostname: 'api.trakt.tv',
        port: 443,
        path: `/users/${username}/history?limit=50&extended=full`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token!.accessToken}`,
          'trakt-api-version': '2',
          'trakt-api-key': process.env.TRAKT_CLIENT_ID,
          'User-Agent': 'curl/7.68.0',
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode ?? 500, body }));
      });

      req.on('error', reject);
      req.end();
    });

    if (res.status < 200 || res.status >= 300) {
      return;
    }

    let data: any[] = [];
    try {
      data = JSON.parse(res.body);
    } catch (err) {
      console.error('📚 Failed to parse history response:', err);
      return;
    }

    if (!Array.isArray(data)) {
      return;
    }

    const pool = getPool();

    // Pre-load all exclusions so each item check is an O(1) Set lookup instead of a DB query.
    const [exclusionRows] = await pool.query(
      `SELECT tmdb_id, media_type, integration FROM scrobble_exclusions`
    );
    const exclusionSet = new Set(
      (exclusionRows as any[]).map((r) => `${r.integration}:${r.media_type}:${r.tmdb_id}`)
    );
    const isExcludedFast = (tmdbId: number, mediaType: 'movie' | 'show') =>
      exclusionSet.has(`stremio:${mediaType}:${tmdbId}`);

    // Phase 1: resolve all media IDs sequentially (DB cache; external API only on cache miss).
    type Resolved = { mediaType: 'movie' | 'episode'; mediaId: number; watchedAt: Date };
    const resolved: Array<Resolved | null> = [];

    for (const item of data) {
      try {
        const watchedAt = item.watched_at ? new Date(item.watched_at) : new Date();

        if (item.type === 'movie' && item.movie) {
          const tmdbId = item.movie.ids?.tmdb;
          if (!tmdbId || isExcludedFast(tmdbId, 'movie')) { resolved.push(null); continue; }
          const movie = await getOrFetchMovie(tmdbId);
          resolved.push({ mediaType: 'movie', mediaId: movie.id, watchedAt });
        } else if (item.type === 'episode' && item.episode && item.show) {
          const showTmdbId = item.show.ids?.tmdb;
          const seasonNumber = item.episode.season;
          const episodeNumber = item.episode.number;
          if (!showTmdbId || seasonNumber === undefined || episodeNumber === undefined ||
              isExcludedFast(showTmdbId, 'show')) { resolved.push(null); continue; }
          await getOrFetchShow(showTmdbId);
          const episode = await getOrFetchEpisode(showTmdbId, seasonNumber, episodeNumber);
          resolved.push({ mediaType: 'episode', mediaId: episode.episodeId, watchedAt });
        } else {
          resolved.push(null);
        }
      } catch (err) {
        console.error('📚 Error processing history item:', err);
        resolved.push(null);
      }
    }

    const validItems = resolved.filter(Boolean) as Resolved[];
    if (validItems.length === 0) return;

    // Phase 2: batch check which are already logged (any source, any date).
    const movieItems = validItems.filter((r) => r.mediaType === 'movie');
    const episodeItems = validItems.filter((r) => r.mediaType === 'episode');

    const existingMovieIds = new Set<number>();
    if (movieItems.length > 0) {
      const [rows] = await pool.query(
        `SELECT media_id FROM watch_history WHERE user_id = ? AND media_type = 'movie' AND media_id IN (${movieItems.map(() => '?').join(',')})`,
        [DEFAULT_USER_ID, ...movieItems.map((r) => r.mediaId)]
      );
      (rows as any[]).forEach((r) => existingMovieIds.add(r.media_id));
    }

    const existingEpisodeIds = new Set<number>();
    if (episodeItems.length > 0) {
      const [rows] = await pool.query(
        `SELECT media_id FROM watch_history WHERE user_id = ? AND media_type = 'episode' AND media_id IN (${episodeItems.map(() => '?').join(',')})`,
        [DEFAULT_USER_ID, ...episodeItems.map((r) => r.mediaId)]
      );
      (rows as any[]).forEach((r) => existingEpisodeIds.add(r.media_id));
    }

    // Phase 3: bulk insert new items.
    const newMovies = movieItems.filter((r) => !existingMovieIds.has(r.mediaId));
    const newEpisodes = episodeItems.filter((r) => !existingEpisodeIds.has(r.mediaId));

    if (newMovies.length > 0) {
      const placeholders = newMovies.map(() => "(?, 'movie', ?, 100, 'trakt.tv', ?, 100)").join(', ');
      await pool.query(
        `INSERT INTO watch_history (user_id, media_type, media_id, progress_pct, source, watched_at, completion_progress) VALUES ${placeholders}`,
        newMovies.flatMap((r) => [DEFAULT_USER_ID, r.mediaId, r.watchedAt])
      );
    }

    if (newEpisodes.length > 0) {
      const placeholders = newEpisodes.map(() => "(?, 'episode', ?, 100, 'trakt.tv', ?, 100)").join(', ');
      await pool.query(
        `INSERT INTO watch_history (user_id, media_type, media_id, progress_pct, source, watched_at, completion_progress) VALUES ${placeholders}`,
        newEpisodes.flatMap((r) => [DEFAULT_USER_ID, r.mediaId, r.watchedAt])
      );
    }

    console.log(`📚 History sync complete — ${newEpisodes.length} new episodes, ${newMovies.length} new movies`);
  } catch (err) {
    console.error('📚 History sync error:', err);
  }
}

async function pollNow(): Promise<void> {
  let token = await getTraktToken();
  if (!token?.username) {
    return;
  }

  if (token.expiresAt < new Date()) {
    try {
      token = await refreshTraktToken();
    } catch (err) {
      console.error('🔁 Background poll: token refresh failed', err);
      return;
    }
  }

  if (!process.env.TRAKT_CLIENT_ID) {
    console.error('🔁 Background poll: TRAKT_CLIENT_ID not set');
    return;
  }

  const username = token.username;
  let res: { status: number; body: string };
  try {
    res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const options = {
        hostname: 'api.trakt.tv',
        port: 443,
        path: `/users/${username}/watching`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token!.accessToken}`,
          'trakt-api-version': '2',
          'trakt-api-key': process.env.TRAKT_CLIENT_ID,
          'User-Agent': 'curl/7.68.0',
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode ?? 500, body }));
      });

      req.on('error', reject);
      req.end();
    });
  } catch (err) {
    console.error('🔁 Background poll: request failed', err);
    return;
  }

  if (res.status === 204) {
    await clearNowPlaying(DEFAULT_USER_ID);
    return;
  }

  if (res.status < 200 || res.status >= 300) {
    console.log('❌ Background poll - Trakt error:', res.status, res.body.substring(0, 200));
    return;
  }

  let data: {
    started_at?: string;
    expires_at?: string;
    progress?: number;
    type: 'movie' | 'episode';
    movie?: { ids: { tmdb: number } };
    episode?: { ids: { tmdb: number }; season: number; number: number };
    show?: { ids: { tmdb: number } };
  } | null = null;

  try {
    data = JSON.parse(res.body);
  } catch (err) {
    console.error('🔁 Background poll: failed to parse response', `(${res.status}) ${res.body.substring(0, 200)}`, err);
    return;
  }

  if (!data) {
    return;
  }

  let progressPct = data.progress ? Math.round(data.progress) : 50;
  if (data.started_at && data.expires_at && !data.progress) {
    const start = new Date(data.started_at).getTime();
    const end = new Date(data.expires_at).getTime();
    const now = Date.now();
    const total = end - start;
    if (total > 0) {
      progressPct = Math.min(99, Math.round(((now - start) / total) * 100));
    }
  }

  if (data.type === 'movie' && data.movie) {
    const tmdbId = data.movie.ids.tmdb;
    const movie = await getOrFetchMovie(tmdbId);
    await updateNowPlaying(DEFAULT_USER_ID, 'stremio', 'movie', movie.id, progressPct);
    const isExcluded = await isScrobbleExcluded(tmdbId, 'movie', 'stremio');
    if (!isExcluded && progressPct >= WATCH_THRESHOLD.movie) {
      await upsertWatchHistory(DEFAULT_USER_ID, 'stremio', 'movie', movie.id, progressPct);
      void checkMovieWatchlistCompletion(DEFAULT_USER_ID, movie.id)
        .catch(err => console.error('🔁 Background poll: watchlist movie completion check failed:', err));
    }
  } else if (data.type === 'episode' && data.show && data.episode) {
    const showTmdbId = data.show.ids.tmdb;
    const show = await getOrFetchShow(showTmdbId);
    const episode = await getOrFetchEpisode(showTmdbId, data.episode.season, data.episode.number);
    await updateNowPlaying(DEFAULT_USER_ID, 'stremio', 'episode', episode.episodeId, progressPct);
    const isExcluded = await isScrobbleExcluded(showTmdbId, 'episode', 'stremio');
    if (!isExcluded && progressPct >= WATCH_THRESHOLD.episode) {
      await upsertWatchHistory(DEFAULT_USER_ID, 'stremio', 'episode', episode.episodeId, progressPct);
      void checkShowWatchlistCompletion(DEFAULT_USER_ID, show.id)
        .catch(err => console.error('🔁 Background poll: watchlist show completion check failed:', err));
    }
  }
}

export function startBackgroundPoller(): void {
  if (backgroundPoller) return;
  console.log('🔁 Background poller started');
  pollNow().catch(err => console.error('Background poll error:', err));
  syncWatchHistory().catch(err => console.error('History sync error:', err));
  backgroundPoller = setInterval(() => {
    pollNow().catch(err => console.error('Background poll error:', err));
    syncWatchHistory().catch(err => console.error('History sync error:', err));
  }, POLL_INTERVAL);
}

export function stopBackgroundPoller(): void {
  if (backgroundPoller) {
    clearInterval(backgroundPoller);
    backgroundPoller = null;
  }
}

export async function startPollLoop(
  imdbId: string,
  contentType: 'movie' | 'series',
  username: string
): Promise<void> {
  // Stop any existing loops — can only watch one thing at a time
  for (const key of pollers.keys()) {
    stopPollLoop(key);
  }
  console.log('📡 Starting poll loop for:', { imdbId, contentType, username });
  const safety4hTimeout = setTimeout(() => {
    clearNowPlaying(DEFAULT_USER_ID).catch(err => console.error('Error clearing now_playing on timeout:', err));
    stopPollLoop(imdbId);
  }, SAFETY_TIMEOUT);

  let hasSeenActive = false;

  const pollOnce = async () => {
    try {
      let token = await getTraktToken();
      if (!token) {
        console.log('⚠️  No token found, stopping poll');
        stopPollLoop(imdbId);
        return;
      }

      // Auto-refresh if expired
      if (token.expiresAt < new Date()) {
        token = await refreshTraktToken();
      }

      if (!process.env.TRAKT_CLIENT_ID) {
        console.error('⚠️ TRAKT_CLIENT_ID not set in environment');
        stopPollLoop(imdbId);
        clearTimeout(safety4hTimeout);
        return;
      }

      const res = await new Promise<{
        status: number;
        body: string;
      }>((resolve, reject) => {
        const options = {
          hostname: 'api.trakt.tv',
          port: 443,
          path: `/users/${username}/watching`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'trakt-api-version': '2',
            'trakt-api-key': process.env.TRAKT_CLIENT_ID,
            'User-Agent': 'curl/7.68.0',
          },
        };

        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode ?? 500, body }));
        });

        req.on('error', reject);
        req.end();
      });

      if (res.status === 204) {
        if (!hasSeenActive) {
          // Trakt hasn't registered the stream yet — keep polling
          const nextTimeout = setTimeout(pollOnce, POLL_INTERVAL);
          pollers.set(imdbId, nextTimeout);
          return;
        }
        // User stopped watching
        await clearNowPlaying(DEFAULT_USER_ID);
        stopPollLoop(imdbId);
        clearTimeout(safety4hTimeout);
        return;
      }

      if (res.status < 200 || res.status >= 300) {
        console.log('❌ Trakt error response:', res.status, res.body.substring(0, 200));
        stopPollLoop(imdbId);
        clearTimeout(safety4hTimeout);
        return;
      }

      const data = (() => {
        try {
          return JSON.parse(res.body) as {
            started_at?: string;
            expires_at?: string;
            progress?: number;
            type: 'movie' | 'episode';
            movie?: { ids: { tmdb: number } };
            episode?: { ids: { tmdb: number }; season: number; number: number };
            show?: { ids: { tmdb: number } };
          };
        } catch {
          throw new Error(`Invalid JSON response: ${res.body.substring(0, 100)}`);
        }
      })();

      hasSeenActive = true;

      // Calculate progress from elapsed time (Trakt API doesn't return progress directly)
      let progressPct = data.progress ? Math.round(data.progress) : 50;
      if (data.started_at && data.expires_at && !data.progress) {
        const start = new Date(data.started_at).getTime();
        const end = new Date(data.expires_at).getTime();
        const now = Date.now();
        const elapsed = now - start;
        const total = end - start;
        if (total > 0) {
          progressPct = Math.round((elapsed / total) * 100);
          progressPct = Math.min(99, progressPct); // Cap at 99% until it's actually done
        }
      }

      if (data.type === 'movie' && data.movie) {
        const tmdbId = data.movie.ids.tmdb;
        const movie = await getOrFetchMovie(tmdbId);
        await updateNowPlaying(DEFAULT_USER_ID, 'stremio', 'movie', movie.id, progressPct);
        const isExcluded = await isScrobbleExcluded(tmdbId, 'movie', 'stremio');
        if (!isExcluded && progressPct >= WATCH_THRESHOLD.movie) {
          await upsertWatchHistory(DEFAULT_USER_ID, 'stremio', 'movie', movie.id, progressPct);
          void checkMovieWatchlistCompletion(DEFAULT_USER_ID, movie.id)
            .catch(err => console.error('📡 Poll loop: watchlist movie completion check failed:', err));
        }
      } else if (data.type === 'episode' && data.show && data.episode) {
        const showTmdbId = data.show.ids.tmdb;
        const seasonNumber = data.episode.season;
        const episodeNumber = data.episode.number;
        const show = await getOrFetchShow(showTmdbId);
        const episode = await getOrFetchEpisode(showTmdbId, seasonNumber, episodeNumber);
        await updateNowPlaying(DEFAULT_USER_ID, 'stremio', 'episode', episode.episodeId, progressPct);
        const isExcluded = await isScrobbleExcluded(showTmdbId, 'episode', 'stremio');
        if (!isExcluded && progressPct >= WATCH_THRESHOLD.episode) {
          await upsertWatchHistory(DEFAULT_USER_ID, 'stremio', 'episode', episode.episodeId, progressPct);
          void checkShowWatchlistCompletion(DEFAULT_USER_ID, show.id)
            .catch(err => console.error('📡 Poll loop: watchlist show completion check failed:', err));
        }
      }

      // Reschedule next poll
      const nextTimeout = setTimeout(pollOnce, POLL_INTERVAL);
      pollers.set(imdbId, nextTimeout);
    } catch (err) {
      console.error('Poll loop error:', err);
      stopPollLoop(imdbId);
      clearTimeout(safety4hTimeout);
    }
  };

  // Initial delay before first poll (Stremio→Trakt has ~30s lag)
  const initialTimeout = setTimeout(pollOnce, INITIAL_DELAY);
  pollers.set(imdbId, initialTimeout);
}

export function stopPollLoop(imdbId: string): void {
  const timeout = pollers.get(imdbId);
  if (timeout) {
    clearTimeout(timeout);
    pollers.delete(imdbId);
  }
}

