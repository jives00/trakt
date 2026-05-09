import https from 'https';
import { getPool } from '../db';
import { isScrobbleExcluded, upsertWatchHistory, updateNowPlaying, clearNowPlaying } from './scrobble.service';
import { getOrFetchMovie } from './movies.service';
import { getOrFetchShow, getOrFetchEpisode } from './shows.service';

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
  };

  await setTraktToken(newToken);
  return newToken;
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
    clearNowPlaying().catch(err => console.error('Error clearing now_playing on timeout:', err));
    stopPollLoop(imdbId);
  }, SAFETY_TIMEOUT);

  let hasSeenActive = false;

  const pollOnce = async () => {
    try {
      console.log('🔄 Poll cycle for', imdbId);
      let token = await getTraktToken();
      if (!token) {
        console.log('⚠️  No token found, stopping poll');
        stopPollLoop(imdbId);
        return;
      }

      // Auto-refresh if expired
      if (token.expiresAt < new Date()) {
        console.log('🔄 Refreshing expired token');
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

      console.log('📊 Trakt response:', res.status);
      if (res.status === 204) {
        if (!hasSeenActive) {
          // Trakt hasn't registered the stream yet — keep polling
          console.log('📊 Trakt returned 204 - stream not registered yet, continuing to poll');
          const nextTimeout = setTimeout(pollOnce, POLL_INTERVAL);
          pollers.set(imdbId, nextTimeout);
          return;
        }
        // User stopped watching
        console.log('📊 Trakt returned 204 - nothing playing');
        await clearNowPlaying();
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
        const isExcluded = await isScrobbleExcluded(tmdbId, 'movie', 'stremio');
        if (!isExcluded) {
          const movie = await getOrFetchMovie(tmdbId);
          console.log('📝 Updating now_playing: movie', movie.id, 'progress', progressPct);
          await updateNowPlaying('stremio', 'movie', movie.id, progressPct);
          if (progressPct >= WATCH_THRESHOLD.movie) {
            await upsertWatchHistory('stremio', 'movie', movie.id, progressPct);
          }
        }
      } else if (data.type === 'episode' && data.show && data.episode) {
        const showTmdbId = data.show.ids.tmdb;
        const seasonNumber = data.episode.season;
        const episodeNumber = data.episode.number;
        const isExcluded = await isScrobbleExcluded(showTmdbId, 'episode', 'stremio');
        if (!isExcluded) {
          await getOrFetchShow(showTmdbId);
          const episode = await getOrFetchEpisode(showTmdbId, seasonNumber, episodeNumber);
          console.log('📝 Updating now_playing: episode', episode.episodeId, 'progress', progressPct);
          await updateNowPlaying('stremio', 'episode', episode.episodeId, progressPct);
          if (progressPct >= WATCH_THRESHOLD.episode) {
            await upsertWatchHistory('stremio', 'episode', episode.episodeId, progressPct);
          }
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

