import { z } from 'zod';

export const WatchBody = z.object({
  mediaType: z.enum(['movie', 'episode']),
  mediaId: z.number().int().positive(),
  watchedAt: z.string().datetime().optional(),
  progressPct: z.number().min(0).max(100).optional(),
});
export type WatchBody = z.infer<typeof WatchBody>;

export interface WatchHistoryEntry {
  id: number;
  mediaType: 'movie' | 'episode';
  mediaId: number;
  watchedAt: string;
  progressPct: number;
  source: 'manual' | 'emby' | 'stremio' | 'kodi';
}

export interface ContinueWatchingItem {
  showId: number;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  nextEpisode: {
    seasonNumber: number;
    episodeNumber: number;
    title: string;
  };
  lastWatchedAt: string;
}

export interface MovieStatus {
  inWatchlist: boolean;
  inCollection: boolean;
  watched: boolean;
}

export interface ShowStatus {
  inWatchlist: boolean;
  inCollection: boolean;
  watched: boolean;
}

export interface UpNextItem {
  showTmdbId: number;
  showTitle: string;
  posterPath: string | null;
  backdropPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeId: number;
  episodeTitle: string | null;
  airDate: string | null;
  watchedCount: number;
  totalAired: number;
}

export interface ScheduleItem {
  mediaType: 'episode' | 'movie';
  showTmdbId?: number;
  showTitle?: string;
  movieTmdbId?: number;
  movieTitle?: string;
  movieTagline?: string | null;
  posterPath: string | null;
  network?: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string | null;
  date: string;
  airTime?: string | null;
}

export interface NowPlayingItem {
  mediaType: 'movie' | 'episode';
  progressPct: number;
  // Movie fields
  movieTmdbId: number | null;
  movieTitle: string | null;
  tagline: string | null;
  backdropPath: string | null;
  runtimeMin: number | null;
  // Episode fields
  showTmdbId: number | null;
  showTitle: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  stillPath: string | null;
  showBackdropPath: string | null;
  showRuntimeMin: number | null;
}
