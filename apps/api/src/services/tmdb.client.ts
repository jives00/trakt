import { SearchResult } from '@trakt/types';

const BASE = 'https://api.themoviedb.org/3';

export async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_API_KEY ?? ''}`,
    },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json() as Promise<T>;
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

export async function searchTmdb(query: string): Promise<SearchResult[]> {
  const data = await get<{ results: Record<string, any>[] }>('/search/multi', {
    query,
    include_adult: 'false',
  });
  return data.results
    .map(transformSearchResult)
    .filter((r): r is SearchResult => r !== null);
}

export async function fetchMediaImages(
  mediaType: 'show' | 'movie',
  tmdbId: number,
): Promise<{ backdrops: string[]; posters: string[] }> {
  const path = mediaType === 'show' ? `/tv/${tmdbId}/images` : `/movie/${tmdbId}/images`;
  const data = await get<{
    backdrops: { file_path: string; vote_average: number; iso_639_1: string | null }[];
    posters: { file_path: string; vote_average: number; iso_639_1: string | null }[];
  }>(path);
  const backdrops = (data.backdrops ?? [])
    .sort((a, b) => b.vote_average - a.vote_average)
    .slice(0, 24)
    .map((b) => b.file_path);
  const posters = (data.posters ?? [])
    .filter((p) => !p.iso_639_1 || p.iso_639_1 === 'en')
    .sort((a, b) => b.vote_average - a.vote_average)
    .slice(0, 24)
    .map((p) => p.file_path);
  return { backdrops, posters };
}
