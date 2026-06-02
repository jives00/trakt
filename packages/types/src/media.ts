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
  digitalReleaseDate?: string | null;
  physicalReleaseDate?: string | null;
  tagline?: string | null;
  rtCriticScore?: number | null;
  rtAudienceScore?: number | null;
  imdbId?: string | null;
  tmdbRating?: number | null;
  trailerYoutubeKey?: string | null;
}

export interface MovieDetail extends Movie {
  originCountry: string | null;
  originalLanguage: string | null;
  productionCompany: string | null;
}

export interface MovieCastMember {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  character: string;
  order: number;
}

export interface CrewMember {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  job: string;
  department: string;
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
  rtCriticScore?: number | null;
  rtAudienceScore?: number | null;
  imdbId?: string | null;
  tmdbRating?: number | null;
  trailerYoutubeKey?: string | null;
}

export interface Season {
  id: number;
  showId: number;
  seasonNumber: number;
  episodeCount: number;
  overview: string | null;
  posterPath: string | null;
  airDate: string | null;
  seasonType?: string; // 'regular' or 'special' from TMDB
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
  episodeType?: string;
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

export type MovieDiscoverCategory = 'trending' | 'popular' | 'now_playing' | 'upcoming' | 'top_rated';
export type ShowDiscoverCategory = 'trending' | 'popular' | 'on_the_air' | 'airing_today' | 'top_rated';
export type DiscoverCategory = MovieDiscoverCategory | ShowDiscoverCategory;
export type DiscoverPeriod = 'all_time' | 'past_year' | 'past_6_months' | 'past_3_months' | 'past_month';

export interface DiscoverItem {
  tmdbId: number;
  mediaType: 'movie' | 'show';
  title: string;
  year: number | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number | null;
  releaseDate: string | null;
}

export interface DiscoverResponse {
  category: DiscoverCategory;
  period: DiscoverPeriod;
  page: number;
  totalPages: number;
  totalResults: number;
  items: DiscoverItem[];
}
