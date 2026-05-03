import type {
  SearchResult, Movie,
  ShowDetail, EpisodeItem, EpisodeDetail, CastMember, ShowEpisodeSummary, SeasonSummary,
  HistoryItem, ProgressItem,
  CollectionItem, WatchlistItem,
  UserList, ListDetail,
  RatingItem,
  StatsAllTime, StatsYear, StatsMonth, DashboardStats, RecentItem, RecommendationItem,
  MovieStatus, ShowStatus, UpNextItem, ScheduleItem,
  UserProfile,
} from "@trakt/types";

export type { ShowDetail, EpisodeItem, EpisodeDetail, CastMember, ShowEpisodeSummary, SeasonSummary, MovieStatus, ShowStatus, UpNextItem, ScheduleItem };

const BASE = "";

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
  // Auth
  login: (username: string, password: string) =>
    request<{ accessToken: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  refresh: () =>
    request<{ accessToken: string }>("/api/auth/refresh", { method: "POST" }),
  logout: (token: string) =>
    request<void>("/api/auth/logout", { method: "POST", token }),

  // User
  getProfile: (token: string) =>
    request<UserProfile>("/api/user/profile", { token }),
  updateProfile: (displayName: string, token: string) =>
    request<UserProfile>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ displayName }),
      token,
    }),

  // Search
  search: (query: string, token: string) =>
    request<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`, { token }),

  // Movies
  getMovie: (tmdbId: number, token: string) =>
    request<{ movie: Movie & { id: number }; status: MovieStatus }>(`/api/movies/${tmdbId}`, { token }),
  toggleMovieWatched: (tmdbId: number, watched: boolean, token: string) =>
    request<{ watched: boolean }>(`/api/movies/${tmdbId}/watched`, {
      method: watched ? "DELETE" : "POST", token,
    }),
  toggleMovieWatchlist: (tmdbId: number, inWatchlist: boolean, token: string) =>
    request<{ inWatchlist: boolean }>(`/api/movies/${tmdbId}/watchlist`, {
      method: inWatchlist ? "DELETE" : "POST", token,
    }),
  toggleMovieCollection: (tmdbId: number, inCollection: boolean, token: string) =>
    request<{ inCollection: boolean }>(`/api/movies/${tmdbId}/collection`, {
      method: inCollection ? "DELETE" : "POST", token,
    }),

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
  toggleEpisodeWatched: (tmdbId: number, season: number, ep: number, watched: boolean, token: string) =>
    request<{ watched: boolean; episodeId: number }>(
      `/api/shows/${tmdbId}/seasons/${season}/episodes/${ep}/watched`,
      { method: watched ? "DELETE" : "POST", token },
    ),
  toggleShowWatched: (tmdbId: number, watched: boolean, token: string) =>
    request<{ watched: boolean }>(`/api/shows/${tmdbId}/watched`, {
      method: watched ? "DELETE" : "POST", token,
    }),
  toggleShowWatchlist: (tmdbId: number, inWatchlist: boolean, token: string) =>
    request<{ inWatchlist: boolean }>(`/api/shows/${tmdbId}/watchlist`, {
      method: inWatchlist ? "DELETE" : "POST", token,
    }),
  toggleShowCollection: (tmdbId: number, inCollection: boolean, token: string) =>
    request<{ inCollection: boolean }>(`/api/shows/${tmdbId}/collection`, {
      method: inCollection ? "DELETE" : "POST", token,
    }),
  getShowSeasons: (tmdbId: number, token: string) =>
    request<{ seasons: SeasonSummary[] }>(`/api/shows/${tmdbId}/seasons`, { token }),
  getShowCast: (tmdbId: number, token: string) =>
    request<{ cast: CastMember[] }>(`/api/shows/${tmdbId}/cast`, { token }),
  getShowUpNext: (tmdbId: number, token: string) =>
    request<{ episode: ShowEpisodeSummary | null }>(`/api/shows/${tmdbId}/up-next`, { token }),
  getShowRecentEpisodes: (tmdbId: number, token: string) =>
    request<{ episodes: ShowEpisodeSummary[] }>(`/api/shows/${tmdbId}/recent-episodes`, { token }),

  // Dashboard
  getUpNext: (token: string) =>
    request<UpNextItem[]>("/api/dashboard/up-next", { token }),
  getSchedule: (token: string, range = 7, type = "all") =>
    request<ScheduleItem[]>(`/api/dashboard/schedule?range=${range}&type=${type}`, { token }),
  getRecentItems: (token: string, limit = 10) =>
    request<RecentItem[]>(`/api/dashboard/recent?limit=${limit}`, { token }),
  getDashboardStats: (token: string) =>
    request<DashboardStats>("/api/dashboard/stats", { token }),
  getShowRecommendations: (token: string) =>
    request<RecommendationItem[]>("/api/dashboard/recommendations/shows", { token }),
  getMovieRecommendations: (token: string) =>
    request<RecommendationItem[]>("/api/dashboard/recommendations/movies", { token }),

  // History
  getHistory: (token: string, type = "all", page = 1, limit = 20) =>
    request<{ items: HistoryItem[]; total: number; page: number; limit: number }>(
      `/api/history?type=${type}&page=${page}&limit=${limit}`, { token },
    ),
  deleteHistory: (id: number, token: string) =>
    request<{ deleted: boolean }>(`/api/history/${id}`, { method: "DELETE", token }),

  // Progress
  getProgress: (token: string, status = "all") =>
    request<ProgressItem[]>(`/api/progress?status=${status}`, { token }),

  // Collection
  getCollection: (token: string, type = "all") =>
    request<CollectionItem[]>(`/api/collection?type=${type}`, { token }),

  // Watchlist
  getWatchlist: (token: string, type = "all") =>
    request<WatchlistItem[]>(`/api/watchlist?type=${type}`, { token }),

  // Lists
  getLists: (token: string) =>
    request<UserList[]>("/api/lists", { token }),
  getList: (id: number, token: string) =>
    request<ListDetail>(`/api/lists/${id}`, { token }),
  createList: (name: string, description: string, token: string) =>
    request<UserList>("/api/lists", {
      method: "POST",
      body: JSON.stringify({ name, description }),
      token,
    }),
  deleteList: (id: number, token: string) =>
    request<{ deleted: boolean }>(`/api/lists/${id}`, { method: "DELETE", token }),
  addListItem: (id: number, mediaType: string, mediaId: number, token: string) =>
    request<{ id: number }>(`/api/lists/${id}/items`, {
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
};

