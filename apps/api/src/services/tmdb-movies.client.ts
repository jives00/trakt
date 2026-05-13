import { Movie, MovieDetail, MovieCastMember, CrewMember } from '@trakt/types';
import { get } from './tmdb.client';

function dateOrNull(value: any): string | null {
  return value && String(value).trim() ? String(value) : null;
}

export function transformMovie(raw: Record<string, any>): MovieDetail {
  // Prefer US theatrical release date (type 3) over the default release_date field
  const usTheatrical = (raw['release_dates']?.results as Record<string, any>[] | undefined)
    ?.find((r: Record<string, any>) => r['iso_3166_1'] === 'US')
    ?.release_dates?.find((d: Record<string, any>) => d['type'] === 3)
    ?.release_date?.slice(0, 10) ?? null;

  const releaseDate = dateOrNull(usTheatrical) ?? dateOrNull(raw['release_date']);
  const tmdbRating = raw['vote_average'] ? Math.round(raw['vote_average'] * 10) : null;

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
    originCountry: (raw['origin_country'] as string[] | undefined)?.[0] || null,
    originalLanguage: raw['original_language'] || null,
    productionCompany: (raw['production_companies'] as Record<string, any>[] | undefined)?.[0]?.name || null,
    tmdbRating,
  };
}

export async function fetchMovie(tmdbId: number): Promise<MovieDetail> {
  return transformMovie(
    await get<Record<string, any>>(`/movie/${tmdbId}`, { append_to_response: 'release_dates' }),
  );
}

export async function fetchMovieCredits(tmdbId: number): Promise<{ cast: MovieCastMember[]; crew: CrewMember[] }> {
  const data = await get<{ cast: Record<string, any>[]; crew: Record<string, any>[] }>(`/movie/${tmdbId}/credits`);

  const cast: MovieCastMember[] = (data.cast || [])
    .slice(0, 100)
    .map((c: Record<string, any>) => ({
      tmdbId: c.id,
      name: c.name,
      profilePath: c.profile_path || null,
      character: c.character || '',
      order: c.order ?? 0,
    }))
    .sort((a, b) => a.order - b.order);

  const crew: CrewMember[] = (data.crew || [])
    .map((c: Record<string, any>) => ({
      tmdbId: c.id,
      name: c.name,
      profilePath: c.profile_path || null,
      job: c.job,
      department: c.department,
    }))
    .filter(c => [
      'Director',
      'Producer', 'Executive Producer',
      'Writer', 'Screenplay', 'Story',
      'Director of Photography', 'Cinematographer',
      'Film Editor',
      'Original Music Composer', 'Composer',
      'Production Designer', 'Art Director',
      'Costume Designer',
      'Sound Designer',
    ].includes(c.job));

  return { cast, crew };
}

export async function fetchMovieImdbId(tmdbId: number): Promise<string | null> {
  const data = await get<{ imdb_id?: string | null }>(`/movie/${tmdbId}/external_ids`);
  return data.imdb_id ?? null;
}

export async function fetchMovieRecommendations(tmdbId: number): Promise<{ id: number; title: string; release_date: string; poster_path: string | null; overview: string }[]> {
  const data = await get<{ results: Record<string, any>[] }>(`/movie/${tmdbId}/recommendations`);
  return data.results as { id: number; title: string; release_date: string; poster_path: string | null; overview: string }[];
}
