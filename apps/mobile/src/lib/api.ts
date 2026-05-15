import type {
  SearchResult, Movie,
  ShowDetail, EpisodeItem, EpisodeDetail, CastMember, ShowEpisodeSummary, SeasonSummary,
  MovieDetail, MovieCastMember, CrewMember,
  HistoryItem, ProgressItem,
  UserList, ListDetail, ListType, UpdateListBody,
  RatingItem,
  StatsAllTime, StatsYear, StatsMonth, DashboardStats, RecentItem, RecommendationItem,
  MovieStatus, ShowStatus, UpNextItem, ScheduleItem,
  NowPlayingItem,
  UserProfile,
  DiscoverResponse, MovieDiscoverCategory, ShowDiscoverCategory, DiscoverPeriod,
} from "@trakt/types";
import { API_BASE } from "./constants";

export type { Movie, MovieDetail, ShowDetail, EpisodeItem, EpisodeDetail, CastMember, ShowEpisodeSummary, SeasonSummary, MovieCastMember, CrewMember, MovieStatus, ShowStatus, UpNextItem, ScheduleItem, NowPlayingItem, HistoryItem };

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
  const headers = new Headers(init.headers as HeadersInit);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ accessToken: string; refreshToken: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  refresh: (refreshToken: string) =>
    request<{ accessToken: string }>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
  logout: (token: string, refreshToken: string) =>
    request<void>("/api/auth/logout", {
      method: "POST",
      token,
      body: JSON.stringify({ refreshToken }),
    }),

  // User
  getProfile: (token: string) =>
    request<UserProfile>("/api/user/profile", { token }),
  updateProfile: (displayName: string, token: string) =>
    request<UserProfile>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ displayName }),
      token,
    }),
  changePassword: (currentPassword: string, newPassword: string, token: string) =>
    request<{ ok: boolean }>("/api/user/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
      token,
    }),
  changeUsername: (newUsername: string, token: string) =>
    request<UserProfile>("/api/user/username", {
      method: "PATCH",
      body: JSON.stringify({ newUsername }),
      token,
    }),

  // Search
  search: (query: string, token: string) =>
    request<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`, { token }),

  // Discover
  getMovieDiscover: (category: MovieDiscoverCategory, token: string, page = 1, region = "US", period: DiscoverPeriod = "all_time") =>
    request<DiscoverResponse>(
      `/api/discover/movies?category=${category}&page=${page}&region=${encodeURIComponent(region)}&period=${period}`,
      { token },
    ),
  getShowDiscover: (category: ShowDiscoverCategory, token: string, page = 1, period: DiscoverPeriod = "all_time") =>
    request<DiscoverResponse>(
      `/api/discover/shows?category=${category}&page=${page}&period=${period}`,
      { token },
    ),

  // Movies
  getMovie: (tmdbId: number, token: string) =>
    request<{ movie: MovieDetail & { id: number }; status: MovieStatus }>(`/api/movies/${tmdbId}`, { token }),
  getMovieCast: (tmdbId: number, token: string) =>
    request<{ cast: MovieCastMember[] }>(`/api/movies/${tmdbId}/cast`, { token }),
  getMovieCrew: (tmdbId: number, token: string) =>
    request<{ crew: CrewMember[] }>(`/api/movies/${tmdbId}/crew`, { token }),
  toggleMovieWatched: (tmdbId: number, watched: boolean, token: string, watchedAt?: string) =>
    request<{ watched: boolean }>(`/api/movies/${tmdbId}/watched`, {
      method: watched ? "DELETE" : "POST",
      token,
      body: !watched && watchedAt ? JSON.stringify({ watchedAt }) : undefined,
    }),
  getMovieHistory: (tmdbId: number, token: string) =>
    request<HistoryItem[]>(`/api/movies/${tmdbId}/history`, { token }),
  toggleMovieWatchlist: (tmdbId: number, inWatchlist: boolean, token: string) =>
    request<{ inWatchlist: boolean }>(`/api/movies/${tmdbId}/watchlist`, {
      method: inWatchlist ? "DELETE" : "POST", token,
    }),
  refreshMovieMetadata: (tmdbId: number, token: string) =>
    request<{ movie: MovieDetail & { id: number } }>(`/api/movies/${tmdbId}/metadata/refresh`, { method: "POST", token }),
  refreshMovieCast: (tmdbId: number, token: string) =>
    request<{ cast: MovieCastMember[]; crew: CrewMember[] }>(`/api/movies/${tmdbId}/cast/refresh`, { method: "POST", token }),
  getMovieImages: (tmdbId: number, token: string) =>
    request<{ backdrops: string[]; posters: string[] }>(`/api/movies/${tmdbId}/images`, { token }),

  // Shows
  getShow: (tmdbId: number, token: string) =>
    request<{ show: ShowDetail; status: ShowStatus }>(`/api/shows/${tmdbId}`, { token }),
  getSeason: (tmdbId: number, season: number, token: string) =>
    request<{ episodes: EpisodeItem[]; watchedEpisodeIds: number[] }>(
      `/api/shows/${tmdbId}/seasons/${season}`, { token },
    ),
  getEpisode: (tmdbId: number, season: number, ep: number, token: string) =>
    request<{ episode: EpisodeDetail; watched: boolean }>(
      `/api/shows/${tmdbId}/seasons/${season}/episodes/${ep}`, { token },
    ),
  toggleEpisodeWatched: (tmdbId: number, season: number, ep: number, watched: boolean, token: string, watchedAt?: string) =>
    request<{ watched: boolean; episodeId: number }>(
      `/api/shows/${tmdbId}/seasons/${season}/episodes/${ep}/watched`,
      {
        method: watched ? "DELETE" : "POST",
        token,
        body: !watched && watchedAt ? JSON.stringify({ watchedAt }) : undefined,
      },
    ),
  getEpisodeHistory: (tmdbId: number, season: number, ep: number, token: string) =>
    request<HistoryItem[]>(
      `/api/shows/${tmdbId}/seasons/${season}/episodes/${ep}/history`, { token },
    ),
  toggleShowWatched: (tmdbId: number, watched: boolean, token: string, watchedAt?: string) =>
    request<{ watched: boolean }>(`/api/shows/${tmdbId}/watched`, {
      method: watched ? "DELETE" : "POST",
      token,
      body: !watched && watchedAt ? JSON.stringify({ watchedAt }) : undefined,
    }),
  toggleShowWatchlist: (tmdbId: number, inWatchlist: boolean, token: string) =>
    request<{ inWatchlist: boolean }>(`/api/shows/${tmdbId}/watchlist`, {
      method: inWatchlist ? "DELETE" : "POST", token,
    }),
  toggleShowDropped: (tmdbId: number, token: string) =>
    request<{ inDropped: boolean }>(`/api/shows/${tmdbId}/dropped`, { method: "POST", token }),
  toggleShowRewatch: (tmdbId: number, token: string) =>
    request<{ inRewatch: boolean }>(`/api/shows/${tmdbId}/rewatch`, { method: "POST", token }),
  getShowSeasons: (tmdbId: number, token: string) =>
    request<{ seasons: SeasonSummary[] }>(`/api/shows/${tmdbId}/seasons`, { token }),
  getShowCast: (tmdbId: number, token: string) =>
    request<{ cast: CastMember[] }>(`/api/shows/${tmdbId}/cast`, { token }),
  getEpisodeCast: (tmdbId: number, season: number, ep: number, token: string) =>
    request<{ cast: CastMember[] }>(`/api/shows/${tmdbId}/seasons/${season}/episodes/${ep}/cast`, { token }),
  getShowUpNext: (tmdbId: number, token: string) =>
    request<{ episode: ShowEpisodeSummary | null }>(`/api/shows/${tmdbId}/up-next`, { token }),
  getShowRecentEpisodes: (tmdbId: number, token: string) =>
    request<{ episodes: ShowEpisodeSummary[] }>(`/api/shows/${tmdbId}/recent-episodes`, { token }),
  getShowImages: (tmdbId: number, token: string) =>
    request<{ backdrops: string[]; posters: string[] }>(`/api/shows/${tmdbId}/images`, { token }),
  refreshShowMetadata: (tmdbId: number, token: string) =>
    request<{ show: ShowDetail }>(`/api/shows/${tmdbId}/metadata/refresh`, { method: "POST", token }),
  refreshShowSeasons: (tmdbId: number, token: string) =>
    request<{ ok: boolean }>(`/api/shows/${tmdbId}/seasons/refresh`, { method: "POST", token }),
  refreshSeasonEpisodes: (tmdbId: number, season: number, token: string) =>
    request<{ seasonId: number; showId: number; episodes: EpisodeItem[] }>(`/api/shows/${tmdbId}/seasons/${season}/episodes/refresh`, { method: "POST", token }),
  refreshShowCast: (tmdbId: number, token: string) =>
    request<{ cast: CastMember[] }>(`/api/shows/${tmdbId}/cast/refresh`, { method: "POST", token }),

  // Dashboard
  getUpNext: (token: string) =>
    request<UpNextItem[]>("/api/dashboard/up-next", { token }),
  getSchedule: (token: string, range = 7, type = "all", startDays = 0) =>
    request<ScheduleItem[]>(`/api/dashboard/schedule?range=${range}&type=${type}&startDays=${startDays}`, { token }),
  getRecentItems: (token: string, limit = 10) =>
    request<RecentItem[]>(`/api/dashboard/recent?limit=${limit}`, { token }),
  getDashboardStats: (token: string) =>
    request<DashboardStats>("/api/dashboard/stats", { token }),
  getDashboardArt: (token: string) =>
    request<string[]>("/api/dashboard/art", { token }),
  getShowRecommendations: (token: string) =>
    request<RecommendationItem[]>("/api/dashboard/recommendations/shows", { token }),
  getMovieRecommendations: (token: string) =>
    request<RecommendationItem[]>("/api/dashboard/recommendations/movies", { token }),
  getNowPlaying: (token: string) =>
    request<NowPlayingItem | null>("/api/scrobble/now-playing", { token }),

  // History
  getHistory: (token: string, type = "all", page = 1, limit = 20, date?: string) => {
    const params = new URLSearchParams({ type, page: String(page), limit: String(limit) });
    if (date) params.append("date", date);
    return request<{ items: HistoryItem[]; total: number; page: number; limit: number }>(
      `/api/history?${params.toString()}`, { token },
    );
  },
  deleteHistory: (id: number, token: string) =>
    request<{ deleted: boolean }>(`/api/history/${id}`, { method: "DELETE", token }),

  // Progress
  getProgress: (token: string, status = "all") =>
    request<ProgressItem[]>(`/api/progress?status=${status}`, { token }),

  // Lists
  getLists: (token: string) =>
    request<UserList[]>("/api/lists", { token }),
  getListMembership: (mediaType: string, mediaId: number, token: string) =>
    request<{ listIds: number[] }>(`/api/lists/membership?mediaType=${mediaType}&mediaId=${mediaId}`, { token }),
  getList: (id: number, token: string) =>
    request<ListDetail>(`/api/lists/${id}`, { token }),
  getListByType: (type: ListType, token: string) =>
    request<ListDetail>(`/api/lists/by-type/${type}`, { token }),
  createList: (name: string, description: string, token: string) =>
    request<UserList>("/api/lists", {
      method: "POST",
      body: JSON.stringify({ name, description }),
      token,
    }),
  updateList: (id: number, body: UpdateListBody, token: string) =>
    request<UserList>(`/api/lists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
    }),
  deleteList: (id: number, token: string) =>
    request<{ deleted: boolean }>(`/api/lists/${id}`, { method: "DELETE", token }),
  addListItem: (id: number, mediaType: string, mediaId: number, token: string) =>
    request<{ added: boolean }>(`/api/lists/${id}/items`, {
      method: "POST",
      body: JSON.stringify({ mediaType, mediaId }),
      token,
    }),
  removeListItem: (id: number, mediaType: string, mediaId: number, token: string) =>
    request<{ deleted: boolean }>(`/api/lists/${id}/items/${mediaType}/${mediaId}`, {
      method: "DELETE", token,
    }),

  // Ratings
  getRatings: (token: string, type = "all", sort = "date", page = 1, limit = 20) =>
    request<{ items: RatingItem[]; total: number; page: number; limit: number }>(
      `/api/ratings?type=${type}&sort=${sort}&page=${page}&limit=${limit}`, { token },
    ),
  upsertRating: (mediaType: string, mediaId: number, rating: number, token: string) =>
    request<{ mediaType: string; mediaId: number; rating: number }>("/api/ratings", {
      method: "POST",
      body: JSON.stringify({ mediaType, mediaId, rating }),
      token,
    }),
  deleteRating: (mediaType: string, mediaId: number, token: string) =>
    request<{ deleted: boolean }>(`/api/ratings/${mediaType}/${mediaId}`, {
      method: "DELETE", token,
    }),

  // Stats
  getStatsAllTime: (token: string) =>
    request<StatsAllTime>("/api/stats/alltime", { token }),
  getStatsYear: (year: number, token: string) =>
    request<StatsYear>(`/api/stats/year/${year}`, { token }),
  getStatsMonth: (year: number, month: number, token: string) =>
    request<StatsMonth>(`/api/stats/month/${year}/${month}`, { token }),

  // Settings
  getApiKey: (token: string) =>
    request<{ apiKey: string }>("/api/settings/api-key", { token }),
  getExportToken: (token: string) =>
    request<{ exportToken: string | null }>("/api/settings/export-token", { token }),
  rotateExportToken: (token: string) =>
    request<{ exportToken: string }>("/api/settings/export-token/rotate", { method: "POST", token }),
  getExclusions: (token: string, integration: string) =>
    request<Array<{ id: number; title: string; integration: string }>>(
      `/api/settings/exclusions?integration=${integration}`, { token },
    ),
  addExclusion: (title: string, integration: string, token: string) =>
    request<{ id: number }>("/api/settings/exclusions", {
      method: "POST",
      body: JSON.stringify({ title, integration }),
      token,
    }),
  deleteExclusion: (id: number, token: string) =>
    request<{ deleted: boolean }>(`/api/settings/exclusions/${id}`, { method: "DELETE", token }),

};
