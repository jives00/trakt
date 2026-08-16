export interface HistoryItem {
  id: number;
  mediaType: 'movie' | 'episode';
  mediaId: number;
  watchedAt: string;
  progressPct: number;
  // 'stremio' and 'trakt.tv' are historical only — those integrations are removed.
  source: 'manual' | 'emby' | 'kodi' | 'nuvio' | 'stremio' | 'trakt.tv';
  tmdbId: number | null;
  title: string | null;
  posterPath: string | null;
  showTitle?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}

export interface ProgressItem {
  showId: number;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  status: string | null;
  network: string | null;
  totalEpisodes: number;
  watchedEpisodes: number;
  totalSeasons: number;
  lastWatchedAt: string;
  nextEpisode: {
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
  } | null;
}
