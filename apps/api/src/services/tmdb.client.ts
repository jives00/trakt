import { Movie, TvShow, Season, Episode, SearchResult } from '@trakt/types';

const BASE = 'https://api.themoviedb.org/3';

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export function transformMovie(raw: Record<string, any>): Movie {
  return {
    id: 0,
    tmdbId: raw['id'],
    title: raw['title'] ?? '',
    year: raw['release_date'] ? Number(String(raw['release_date']).slice(0, 4)) : 0,
    overview: raw['overview'] ?? '',
    posterPath: raw['poster_path'] ?? null,
    backdropPath: raw['backdrop_path'] ?? null,
    runtimeMin: raw['runtime'] ?? null,
    genres: (raw['genres'] ?? []).map((g: Record<string, any>) => g['name']),
  };
}

export function transformShow(raw: Record<string, any>): TvShow {
  return {
    id: 0,
    tmdbId: raw['id'],
    title: raw['name'] ?? '',
    year: raw['first_air_date'] ? Number(String(raw['first_air_date']).slice(0, 4)) : 0,
    overview: raw['overview'] ?? '',
    posterPath: raw['poster_path'] ?? null,
    backdropPath: raw['backdrop_path'] ?? null,
    status: raw['status'] ?? null,
    network: raw['networks']?.[0]?.['name'] ?? null,
    genres: (raw['genres'] ?? []).map((g: Record<string, any>) => g['name']),
  };
}

export function transformSearchResult(raw: Record<string, any>): SearchResult | null {
  if (raw['media_type'] === 'movie') {
    return {
      tmdbId: raw['id'],
      mediaType: 'movie',
      title: raw['title'] ?? '',
      year: raw['release_date'] ? Number(String(raw['release_date']).slice(0, 4)) : null,
      posterPath: raw['poster_path'] ?? null,
      overview: raw['overview'] ?? '',
    };
  }
  if (raw['media_type'] === 'tv') {
    return {
      tmdbId: raw['id'],
      mediaType: 'show',
      title: raw['name'] ?? '',
      year: raw['first_air_date'] ? Number(String(raw['first_air_date']).slice(0, 4)) : null,
      posterPath: raw['poster_path'] ?? null,
      overview: raw['overview'] ?? '',
    };
  }
  return null;
}

function transformEpisode(ep: Record<string, any>, showId = 0, seasonId = 0): Episode {
  return {
    id: 0,
    showId,
    seasonId,
    episodeNumber: ep['episode_number'],
    title: ep['name'] ?? '',
    overview: ep['overview'] ?? null,
    stillPath: ep['still_path'] ?? null,
    airDate: ep['air_date'] ?? null,
    runtimeMin: ep['runtime'] ?? null,
  };
}

export async function searchTmdb(query: string): Promise<SearchResult[]> {
  const data = await get<{ results: Record<string, any>[] }>('/search/multi', {
    query,
    include_adult: 'false',
  });
  return data.results
    .map(transformSearchResult)
    .filter((r): r is SearchResult => r !== null);
}

export async function fetchMovie(tmdbId: number): Promise<Movie> {
  return transformMovie(await get<Record<string, any>>(`/movie/${tmdbId}`));
}

export async function fetchShow(tmdbId: number): Promise<TvShow> {
  return transformShow(await get<Record<string, any>>(`/tv/${tmdbId}`));
}

export async function fetchShowWithSeasonCount(tmdbId: number): Promise<{ show: TvShow; seasonCount: number }> {
  const raw = await get<Record<string, any>>(`/tv/${tmdbId}`);
  return { show: transformShow(raw), seasonCount: raw['number_of_seasons'] ?? 0 };
}

export async function fetchSeason(tmdbId: number, seasonNumber: number): Promise<Season> {
  const raw = await get<Record<string, any>>(`/tv/${tmdbId}/season/${seasonNumber}`);
  return {
    id: 0,
    showId: 0,
    seasonNumber: raw['season_number'],
    episodeCount: raw['episodes']?.length ?? 0,
    overview: raw['overview'] ?? null,
    posterPath: raw['poster_path'] ?? null,
    airDate: raw['air_date'] ?? null,
    episodes: (raw['episodes'] ?? []).map((ep: Record<string, any>) =>
      transformEpisode(ep),
    ),
  };
}

export async function fetchEpisode(
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<Episode> {
  const raw = await get<Record<string, any>>(
    `/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`,
  );
  return transformEpisode(raw);
}
