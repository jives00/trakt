export interface Movie {
  id: number;
  tmdbId: number;
  title: string;
  year: number;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  runtimeMin: number | null;
  genres: string[];
}

export interface TvShow {
  id: number;
  tmdbId: number;
  title: string;
  year: number;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  status: string | null;
  network: string | null;
  genres: string[];
}

export interface Season {
  id: number;
  showId: number;
  seasonNumber: number;
  episodeCount: number;
  overview: string | null;
  posterPath: string | null;
  airDate: string | null;
  episodes?: Episode[];
}

export interface Episode {
  id: number;
  showId: number;
  seasonId: number;
  episodeNumber: number;
  title: string;
  overview: string | null;
  stillPath: string | null;
  airDate: string | null;
  airTime: string | null;
  runtimeMin: number | null;
}

export interface ShowDetail extends TvShow {
  seasonCount: number;
}

export interface EpisodeItem {
  id: number;
  episodeNumber: number;
  title: string | null;
  airDate: string | null;
  stillPath: string | null;
  runtimeMin: number | null;
}

export interface EpisodeDetail extends EpisodeItem {
  overview: string | null;
  showTmdbId: number;
  showTitle: string;
  seasonNumber: number;
}

export interface SearchResult {
  tmdbId: number;
  mediaType: 'movie' | 'show';
  title: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
}
