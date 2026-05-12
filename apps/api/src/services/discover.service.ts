import { DiscoverItem, DiscoverPeriod, DiscoverResponse, MovieDiscoverCategory, ShowDiscoverCategory } from '@trakt/types';
import { get } from './tmdb.client';

const MOVIE_CATEGORIES: Record<MovieDiscoverCategory, string> = {
  trending: '/trending/movie/week',
  popular: '/movie/popular',
  now_playing: '/movie/now_playing',
  upcoming: '/movie/upcoming',
  top_rated: '/movie/top_rated',
};

const SHOW_CATEGORIES: Record<ShowDiscoverCategory, string> = {
  trending: '/trending/tv/week',
  popular: '/tv/popular',
  on_the_air: '/tv/on_the_air',
  airing_today: '/tv/airing_today',
  top_rated: '/tv/top_rated',
};

interface TmdbListResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: Record<string, any>[];
}

export const movieDiscoverCategories = Object.keys(MOVIE_CATEGORIES) as MovieDiscoverCategory[];
export const showDiscoverCategories = Object.keys(SHOW_CATEGORIES) as ShowDiscoverCategory[];
export const discoverPeriods: DiscoverPeriod[] = ['all_time', 'past_year', 'past_6_months', 'past_3_months', 'past_month'];

export function isMovieDiscoverCategory(value: string): value is MovieDiscoverCategory {
  return movieDiscoverCategories.includes(value as MovieDiscoverCategory);
}

export function isShowDiscoverCategory(value: string): value is ShowDiscoverCategory {
  return showDiscoverCategories.includes(value as ShowDiscoverCategory);
}

export function isDiscoverPeriod(value: string): value is DiscoverPeriod {
  return discoverPeriods.includes(value as DiscoverPeriod);
}

export async function getMovieDiscover(
  category: MovieDiscoverCategory,
  page = 1,
  region = 'US',
  period: DiscoverPeriod = 'all_time',
): Promise<DiscoverResponse> {
  const params: Record<string, string> = {
    page: String(page),
    region,
  };
  const path = category === 'top_rated' && period !== 'all_time'
    ? '/discover/movie'
    : MOVIE_CATEGORIES[category];

  if (category === 'top_rated' && period !== 'all_time') {
    Object.assign(params, {
      sort_by: 'vote_average.desc',
      'vote_count.gte': '100',
      include_adult: 'false',
      'primary_release_date.gte': dateFromPeriod(period),
      'primary_release_date.lte': todayIso(),
    });
  }

  const data = await get<TmdbListResponse>(path, params);

  return {
    category,
    period,
    page: data.page,
    totalPages: data.total_pages,
    totalResults: data.total_results,
    items: data.results.map(transformMovieDiscoverItem),
  };
}

export async function getShowDiscover(
  category: ShowDiscoverCategory,
  page = 1,
  period: DiscoverPeriod = 'all_time',
): Promise<DiscoverResponse> {
  const params: Record<string, string> = {
    page: String(page),
  };
  const path = category === 'top_rated' && period !== 'all_time'
    ? '/discover/tv'
    : SHOW_CATEGORIES[category];

  if (category === 'top_rated' && period !== 'all_time') {
    Object.assign(params, {
      sort_by: 'vote_average.desc',
      'vote_count.gte': '50',
      'first_air_date.gte': dateFromPeriod(period),
      'first_air_date.lte': todayIso(),
    });
  }

  const data = await get<TmdbListResponse>(path, params);

  return {
    category,
    period,
    page: data.page,
    totalPages: data.total_pages,
    totalResults: data.total_results,
    items: data.results.map(transformShowDiscoverItem),
  };
}

function transformMovieDiscoverItem(raw: Record<string, any>): DiscoverItem {
  const releaseDate = raw['release_date'] || null;
  return {
    tmdbId: raw['id'],
    mediaType: 'movie',
    title: raw['title'] ?? raw['name'] ?? '',
    year: releaseDate ? Number(String(releaseDate).slice(0, 4)) : null,
    overview: raw['overview'] ?? '',
    posterPath: raw['poster_path'] ?? null,
    backdropPath: raw['backdrop_path'] ?? null,
    rating: typeof raw['vote_average'] === 'number' ? Math.round(raw['vote_average'] * 10) : null,
    releaseDate,
  };
}

function transformShowDiscoverItem(raw: Record<string, any>): DiscoverItem {
  const firstAirDate = raw['first_air_date'] || null;
  return {
    tmdbId: raw['id'],
    mediaType: 'show',
    title: raw['name'] ?? raw['title'] ?? '',
    year: firstAirDate ? Number(String(firstAirDate).slice(0, 4)) : null,
    overview: raw['overview'] ?? '',
    posterPath: raw['poster_path'] ?? null,
    backdropPath: raw['backdrop_path'] ?? null,
    rating: typeof raw['vote_average'] === 'number' ? Math.round(raw['vote_average'] * 10) : null,
    releaseDate: firstAirDate,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateFromPeriod(period: Exclude<DiscoverPeriod, 'all_time'>): string {
  const date = new Date();
  switch (period) {
    case 'past_year':
      date.setFullYear(date.getFullYear() - 1);
      break;
    case 'past_6_months':
      date.setMonth(date.getMonth() - 6);
      break;
    case 'past_3_months':
      date.setMonth(date.getMonth() - 3);
      break;
    case 'past_month':
      date.setMonth(date.getMonth() - 1);
      break;
  }
  return date.toISOString().slice(0, 10);
}
