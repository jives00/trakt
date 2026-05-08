import { TvShow, Season, Episode, CastMember } from '@trakt/types';
import { get } from './tmdb.client';

export function transformShow(raw: Record<string, any>): TvShow {
  const tmdbRating = raw['vote_average'] ? Math.round(raw['vote_average'] * 10) : null;
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
    tmdbRating,
  };
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
    airTime: ep['air_time'] ?? null,
    runtimeMin: ep['runtime'] ?? null,
  };
}

export async function fetchShow(tmdbId: number): Promise<TvShow> {
  return transformShow(await get<Record<string, any>>(`/tv/${tmdbId}`));
}

export interface ShowFetchResult {
  show: TvShow & { firstAirDate: string | null; originCountry: string | null; originalLanguage: string | null; runtimeMin: number | null };
  seasonCount: number;
}

export async function fetchShowWithSeasonCount(tmdbId: number): Promise<ShowFetchResult> {
  const raw = await get<Record<string, any>>(`/tv/${tmdbId}`);
  return {
    show: {
      ...transformShow(raw),
      firstAirDate: raw['first_air_date'] ?? null,
      originCountry: raw['origin_country']?.[0] ?? null,
      originalLanguage: raw['original_language'] ?? null,
      runtimeMin: raw['episode_run_time']?.[0] ?? null,
    },
    seasonCount: raw['number_of_seasons'] ?? 0,
  };
}

export async function fetchShowCast(tmdbId: number): Promise<CastMember[]> {
  const data = await get<{ cast: { id: number; name: string; profile_path: string | null; roles: { character: string; episode_count: number }[]; total_episode_count: number; order: number }[] }>(`/tv/${tmdbId}/aggregate_credits`);
  return (data.cast ?? [])
    .filter(m => m.total_episode_count >= 1)
    .map(m => ({
      tmdbId: m.id,
      name: m.name,
      profilePath: m.profile_path,
      character: m.roles[0]?.character ?? '',
      episodeCount: m.total_episode_count,
      isRegular: m.order < 12,
    }));
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

export async function fetchSeasonCast(tmdbId: number, seasonNumber: number): Promise<CastMember[]> {
  const data = await get<{
    cast: { id: number; name: string; profile_path: string | null; character: string }[];
  }>(`/tv/${tmdbId}/season/${seasonNumber}/credits`);

  return (data.cast ?? []).map((m) => ({
    tmdbId: m.id,
    name: m.name,
    profilePath: m.profile_path,
    character: m.character ?? '',
    episodeCount: 1,
    isRegular: true,
  }));
}

export async function fetchTvdbId(tmdbId: number): Promise<number | null> {
  const data = await get<{ tvdb_id?: number | null }>(`/tv/${tmdbId}/external_ids`);
  return data.tvdb_id ?? null;
}

export async function fetchShowImdbId(tmdbId: number): Promise<string | null> {
  const data = await get<{ imdb_id?: string | null }>(`/tv/${tmdbId}/external_ids`);
  return data.imdb_id ?? null;
}

export async function fetchShowRecommendations(tmdbId: number): Promise<{ id: number; name: string; first_air_date: string; poster_path: string | null; overview: string }[]> {
  const data = await get<{ results: Record<string, any>[] }>(`/tv/${tmdbId}/recommendations`);
  return data.results;
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

export async function fetchEpisodeGuestStars(
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<CastMember[]> {
  const data = await get<{
    guest_stars: { id: number; name: string; profile_path: string | null; character: string }[];
  }>(`/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}/credits`);

  return (data.guest_stars ?? []).map((m) => ({
    tmdbId: m.id,
    name: m.name,
    profilePath: m.profile_path,
    character: m.character ?? '',
    episodeCount: 1,
    isRegular: false,
  }));
}
