export interface DailyActivity {
  date: string;
  count: number;
}

export interface TopShow {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  episodeCount: number;
}

export interface TopGenre {
  genre: string;
  count: number;
}

export interface StatsAllTime {
  totalMinutes: number;
  totalShows: number;
  totalMovies: number;
  totalEpisodes: number;
  longestStreak: number;
  topShows: TopShow[];
  topGenres: TopGenre[];
  heatmap: DailyActivity[];
}

export interface StatsYear {
  year: number;
  totalMinutes: number;
  totalEpisodes: number;
  totalMovies: number;
  newShowsStarted: number;
  showsCompleted: number;
  monthlyBreakdown: { month: number; hours: number }[];
  topShows: TopShow[];
  topGenres: TopGenre[];
}

export interface StatsMonth {
  year: number;
  month: number;
  totalMinutes: number;
  totalEpisodes: number;
  totalMovies: number;
  dailyBreakdown: { day: number; hours: number }[];
  shows: TopShow[];
  movies: { tmdbId: number; title: string; posterPath: string | null }[];
}

export interface DashboardDailyStats {
  date: string;
  hours: number;
}

export interface RecentItem {
  id: number;
  mediaType: 'movie' | 'episode';
  mediaId: number;
  watchedAt: string;
  source: 'manual' | 'emby' | 'stremio' | 'kodi';
  tmdbId: number | null;
  title: string | null;
  posterPath: string | null;
  showTitle?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}
