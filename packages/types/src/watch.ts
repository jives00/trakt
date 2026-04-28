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

export interface ScheduleItem {
  date: string;
  tmdbId: number;
  mediaType: 'movie' | 'episode';
  title: string;
  posterPath: string | null;
  episode?: {
    seasonNumber: number;
    episodeNumber: number;
    title: string;
  };
}
