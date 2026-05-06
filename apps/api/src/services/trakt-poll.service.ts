import { getPool } from '../db';
import { isScrobbleExcluded } from './scrobble.service';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
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
    'SELECT access_token, refresh_token, expires_at FROM trakt_tokens WHERE id = 1'
  );

  if ((rows as any[]).length === 0) {
    return null;
  }

  const row = (rows as any[])[0];
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: new Date(row.expires_at),
  };
}

export async function setTraktToken(token: StoredToken): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO trakt_tokens (id, access_token, refresh_token, expires_at)
     VALUES (1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
     access_token = VALUES(access_token),
     refresh_token = VALUES(refresh_token),
     expires_at = VALUES(expires_at)`,
    [token.accessToken, token.refreshToken, token.expiresAt]
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
  const safety4hTimeout = setTimeout(() => {
    stopPollLoop(imdbId);
  }, SAFETY_TIMEOUT);

  const pollOnce = async () => {
    try {
      let token = await getTraktToken();
      if (!token) {
        stopPollLoop(imdbId);
        return;
      }

      // Auto-refresh if expired
      if (token.expiresAt < new Date()) {
        token = await refreshTraktToken();
      }

      const res = await fetch(`${TRAKT_API}/users/${username}/watching`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'trakt-api-version': '2',
          'trakt-api-key': process.env.TRAKT_CLIENT_ID!,
          'User-Agent': 'TraktClone/1.0 (+https://github.com/)',
        },
      });

      if (res.status === 204) {
        // Nothing playing anymore
        stopPollLoop(imdbId);
        clearTimeout(safety4hTimeout);
        return;
      }

      if (!res.ok) {
        console.error(`Trakt watching endpoint error: ${res.status}`);
        stopPollLoop(imdbId);
        clearTimeout(safety4hTimeout);
        return;
      }

      const data = (await res.json()) as {
        progress: number;
        type: 'movie' | 'episode';
        movie?: { ids: { tmdb: number } };
        episode?: { ids: { tmdb: number } };
        show?: { ids: { tmdb: number } };
      };

      const progressPct = Math.round(data.progress);

      if (data.type === 'movie' && data.movie) {
        const tmdbId = data.movie.ids.tmdb;
        if (progressPct >= WATCH_THRESHOLD.movie) {
          const isExcluded = await isScrobbleExcluded(tmdbId, 'movie', 'stremio');
          if (!isExcluded) {
            await upsertWatchHistory('movie', tmdbId, progressPct);
          }
        }
      } else if (data.type === 'episode' && data.show) {
        const showTmdbId = data.show.ids.tmdb;
        if (progressPct >= WATCH_THRESHOLD.episode) {
          const isExcluded = await isScrobbleExcluded(showTmdbId, 'episode', 'stremio');
          if (!isExcluded) {
            await upsertWatchHistory('episode', showTmdbId, progressPct);
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

async function upsertWatchHistory(
  mediaType: 'movie' | 'episode',
  mediaId: number,
  progressPct: number
): Promise<void> {
  const pool = getPool();

  const existingRow = await pool.query(
    `SELECT id FROM watch_history
     WHERE user_id = 1 AND media_type = ? AND media_id = ? AND DATE(watched_at) = CURDATE()`,
    [mediaType, mediaId]
  );

  if ((existingRow[0] as any[]).length > 0) {
    await pool.query(
      `UPDATE watch_history
       SET progress_pct = ?, watched_at = NOW(), source = 'stremio'
       WHERE user_id = 1 AND media_type = ? AND media_id = ? AND DATE(watched_at) = CURDATE()`,
      [progressPct, mediaType, mediaId]
    );
  } else {
    await pool.query(
      `INSERT INTO watch_history (user_id, media_type, media_id, progress_pct, source, watched_at)
       VALUES (1, ?, ?, ?, 'stremio', NOW())`,
      [mediaType, mediaId, progressPct]
    );
  }
}
