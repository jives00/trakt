import { Movie } from '@trakt/types';
import { get } from './tmdb.client';

export function transformMovie(raw: Record<string, any>): Movie {
  // Prefer US theatrical release date (type 3) over the default release_date field
  const usTheatrical = (raw['release_dates']?.results as Record<string, any>[] | undefined)
    ?.find((r: Record<string, any>) => r['iso_3166_1'] === 'US')
    ?.release_dates?.find((d: Record<string, any>) => d['type'] === 3)
    ?.release_date?.slice(0, 10) ?? null;

  const releaseDate = usTheatrical ?? raw['release_date'] ?? null;

  return {
    id: 0,
    tmdbId: raw['id'],
    title: raw['title'] ?? '',
    year: releaseDate ? Number(String(releaseDate).slice(0, 4)) : 0,
    overview: raw['overview'] ?? '',
    tagline: raw['tagline'] || null,
    posterPath: raw['poster_path'] ?? null,
    backdropPath: raw['backdrop_path'] ?? null,
    runtimeMin: raw['runtime'] ?? null,
    genres: (raw['genres'] ?? []).map((g: Record<string, any>) => g['name']),
    releaseDate: releaseDate || null,
  };
}

export async function fetchMovie(tmdbId: number): Promise<Movie> {
  return transformMovie(
    await get<Record<string, any>>(`/movie/${tmdbId}`, { append_to_response: 'release_dates' }),
  );
}

export async function fetchMovieRecommendations(tmdbId: number): Promise<{ id: number; title: string; release_date: string; poster_path: string | null; overview: string }[]> {
  const data = await get<{ results: Record<string, any>[] }>(`/movie/${tmdbId}/recommendations`);
  return data.results;
}
