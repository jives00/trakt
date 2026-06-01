import { updateNowPlaying, clearNowPlaying, DEFAULT_USER_ID } from './scrobble.service';
import { getOrFetchMovie } from './movies.service';
import { getOrFetchShow, getOrFetchEpisode } from './shows.service';
import { get as tmdbGet } from './tmdb.client';
import { getPool } from '../db';
import { RowDataPacket } from 'mysql2/promise';

const POLL_INTERVAL = 30000;

let poller: NodeJS.Timeout | null = null;

interface EmbySession {
  NowPlayingItem?: {
    Type: string;
    RunTimeTicks: number;
    IndexNumber?: number;
    ParentIndexNumber?: number;
    ProviderIds?: Record<string, string>;
    SeriesProviderIds?: Record<string, string>;
  };
  PlayState?: {
    PositionTicks: number;
    IsPaused: boolean;
  };
}

async function resolveShowTmdbIdFromTvdbEpisode(tvdbEpisodeId: string): Promise<number | null> {
  try {
    const data = await tmdbGet<any>(`/find/${tvdbEpisodeId}?external_source=tvdb_id`);
    return data.tv_episode_results?.[0]?.show_id ?? null;
  } catch {
    return null;
  }
}

async function getCurrentNowPlayingSource(): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT source FROM now_playing WHERE user_id = ? AND updated_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
    [DEFAULT_USER_ID]
  );
  return rows[0]?.source ?? null;
}

async function pollEmby(): Promise<void> {
  const embyUrl = process.env.EMBY_URL;
  const apiKey = process.env.EMBY_API_KEY;
  if (!embyUrl || !apiKey) return;

  let sessions: EmbySession[];
  try {
    const res = await fetch(`${embyUrl}/Sessions?api_key=${apiKey}`);
    if (!res.ok) return;
    sessions = await res.json();
  } catch {
    return;
  }

  const active = sessions.find(s =>
    s.NowPlayingItem &&
    s.PlayState &&
    !s.PlayState.IsPaused &&
    s.NowPlayingItem.RunTimeTicks > 0
  );

  if (!active) {
    const source = await getCurrentNowPlayingSource();
    if (source === 'emby') await clearNowPlaying(DEFAULT_USER_ID);
    return;
  }

  const item = active.NowPlayingItem!;
  const positionTicks = active.PlayState!.PositionTicks;
  const progressPct = Math.min(100, Math.round((positionTicks / item.RunTimeTicks) * 100));

  try {
    if (item.Type === 'Movie') {
      const tmdbIdStr = item.ProviderIds?.Tmdb;
      if (!tmdbIdStr) return;
      const movie = await getOrFetchMovie(parseInt(tmdbIdStr, 10));
      await updateNowPlaying(DEFAULT_USER_ID, 'emby', 'movie', movie.id, progressPct);
    } else if (item.Type === 'Episode') {
      const seasonNumber = item.ParentIndexNumber;
      const episodeNumber = item.IndexNumber;
      if (seasonNumber == null || episodeNumber == null) return;

      let tmdbId: number | null = null;
      const tmdbIdStr = item.SeriesProviderIds?.Tmdb;
      if (tmdbIdStr) tmdbId = parseInt(tmdbIdStr, 10);

      if (!tmdbId) {
        const tvdbEpisodeId = item.ProviderIds?.Tvdb;
        if (tvdbEpisodeId) tmdbId = await resolveShowTmdbIdFromTvdbEpisode(tvdbEpisodeId);
      }

      if (!tmdbId) return;

      await getOrFetchShow(tmdbId);
      const episode = await getOrFetchEpisode(tmdbId, seasonNumber, episodeNumber);
      await updateNowPlaying(DEFAULT_USER_ID, 'emby', 'episode', episode.episodeId, progressPct);
    }
  } catch (err) {
    console.error('Emby poller: error updating now-playing:', err);
  }
}

export function startEmbyPoller(): void {
  if (poller) return;
  if (!process.env.EMBY_URL || !process.env.EMBY_API_KEY) {
    console.log('⏭️  Emby poller skipped — EMBY_URL or EMBY_API_KEY not set');
    return;
  }
  console.log('📡 Emby poller started');
  pollEmby().catch(err => console.error('Emby poll error:', err));
  poller = setInterval(() => {
    pollEmby().catch(err => console.error('Emby poll error:', err));
  }, POLL_INTERVAL);
}

export function stopEmbyPoller(): void {
  if (poller) {
    clearInterval(poller);
    poller = null;
  }
}
