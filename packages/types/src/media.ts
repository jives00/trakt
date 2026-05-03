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
  releaseDate?: string | null;
  tagline?: string | null;
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
  firstAirDate: string | null;
  originCountry: string | null;
  originalLanguage: string | null;
  runtimeMin: number | null;
  airTime: string | null;
  airsDay: string | null;
}

export interface CastMember {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  character: string;
  episodeCount: number;
  isRegular: boolean;
}

export interface ShowEpisodeSummary {
  episodeId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  airDate: string | null;
  stillPath: string | null;
  runtimeMin: number | null;
}

export interface EpisodeItem {
  id: number;
  episodeNumber: number;
  title: string | null;
  overview: string | null;
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

export interface SeasonSummary {
  seasonNumber: number;
  episodeCount: number;
  posterPath: string | null;
}

export interface SearchResult {
  tmdbId: number;
  mediaType: 'movie' | 'show';
  title: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
}
