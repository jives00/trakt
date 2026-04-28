import type { SearchResult, Movie } from "@trakt/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options;
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ accessToken: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  refresh: () =>
    request<{ accessToken: string }>("/api/auth/refresh", { method: "POST" }),

  logout: (token: string) =>
    request<void>("/api/auth/logout", { method: "POST", token }),

  search: (query: string, token: string) =>
    request<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`, { token }),

  getMovie: (tmdbId: number, token: string) =>
    request<{ movie: Movie & { id: number }; status: MovieStatus }>(`/api/movies/${tmdbId}`, { token }),

  toggleMovieWatched: (tmdbId: number, watched: boolean, token: string) =>
    request<{ watched: boolean }>(`/api/movies/${tmdbId}/watched`, {
      method: watched ? 'DELETE' : 'POST', token,
    }),

  toggleMovieWatchlist: (tmdbId: number, inWatchlist: boolean, token: string) =>
    request<{ inWatchlist: boolean }>(`/api/movies/${tmdbId}/watchlist`, {
      method: inWatchlist ? 'DELETE' : 'POST', token,
    }),

  toggleMovieCollection: (tmdbId: number, inCollection: boolean, token: string) =>
    request<{ inCollection: boolean }>(`/api/movies/${tmdbId}/collection`, {
      method: inCollection ? 'DELETE' : 'POST', token,
    }),

  getShow: (tmdbId: number, token: string) =>
    request<{ show: ShowDetail; status: ShowStatus }>(`/api/shows/${tmdbId}`, { token }),

  getSeason: (tmdbId: number, season: number, token: string) =>
    request<{ episodes: EpisodeItem[]; watchedEpisodeIds: number[] }>(
      `/api/shows/${tmdbId}/seasons/${season}`, { token },
    ),

  toggleEpisodeWatched: (tmdbId: number, season: number, ep: number, watched: boolean, token: string) =>
    request<{ watched: boolean; episodeId: number }>(
      `/api/shows/${tmdbId}/seasons/${season}/episodes/${ep}/watched`,
      { method: watched ? 'DELETE' : 'POST', token },
    ),

  toggleShowWatchlist: (tmdbId: number, inWatchlist: boolean, token: string) =>
    request<{ inWatchlist: boolean }>(`/api/shows/${tmdbId}/watchlist`, {
      method: inWatchlist ? 'DELETE' : 'POST', token,
    }),

  toggleShowCollection: (tmdbId: number, inCollection: boolean, token: string) =>
    request<{ inCollection: boolean }>(`/api/shows/${tmdbId}/collection`, {
      method: inCollection ? 'DELETE' : 'POST', token,
    }),

  getUpNext: (token: string) =>
    request<UpNextItem[]>('/api/dashboard/up-next', { token }),

  getSchedule: (token: string) =>
    request<ScheduleEntry[]>('/api/dashboard/schedule', { token }),
};

export interface MovieStatus { inWatchlist: boolean; inCollection: boolean; watched: boolean }
export interface ShowStatus { inWatchlist: boolean; inCollection: boolean }
export interface ShowDetail {
  id: number; tmdbId: number; title: string; year: number; overview: string;
  posterPath: string | null; backdropPath: string | null;
  status: string | null; network: string | null; genres: string[]; seasonCount: number;
}
export interface EpisodeItem {
  id: number; episodeNumber: number; title: string | null;
  airDate: string | null; stillPath: string | null; runtimeMin: number | null;
}

export interface UpNextItem {
  showTmdbId: number; showTitle: string;
  posterPath: string | null; backdropPath: string | null;
  seasonNumber: number; episodeNumber: number;
  episodeId: number; episodeTitle: string | null; airDate: string | null;
}

export interface ScheduleEntry {
  showTmdbId: number; showTitle: string; network: string | null;
  seasonNumber: number; episodeNumber: number;
  episodeTitle: string | null; airDate: string;
}
