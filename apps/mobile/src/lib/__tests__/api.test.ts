import { api, ApiError } from "../api";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3002";

function mockFetch(status: number, body: unknown, ok = status >= 200 && status < 300) {
  const text = body === undefined || status === 204 ? "" : JSON.stringify(body);
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    status,
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(body ?? {}),
    statusText: "Error",
  } as unknown as Response);
}

afterEach(() => {
  jest.resetAllMocks();
});

describe("ApiError", () => {
  it("carries status and message", () => {
    const err = new ApiError(404, "Not Found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not Found");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("api.login", () => {
  it("sends POST to /api/auth/login with credentials", async () => {
    mockFetch(200, { accessToken: "at", refreshToken: "rt" });
    const result = await api.login("user", "pass");
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/api/auth/login`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({ accessToken: "at", refreshToken: "rt" });
  });

  it("throws ApiError on 401", async () => {
    mockFetch(401, { error: "Invalid credentials" }, false);
    await expect(api.login("user", "wrong")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("api.refresh", () => {
  it("sends POST to /api/auth/refresh with refreshToken in body", async () => {
    mockFetch(200, { accessToken: "new-at" });
    const result = await api.refresh("my-rt");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/auth/refresh`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: "my-rt" });
    expect(result.accessToken).toBe("new-at");
  });

  it("throws ApiError on 403", async () => {
    mockFetch(403, { error: "Token expired" }, false);
    await expect(api.refresh("bad-rt")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("api.logout", () => {
  it("sends POST to /api/auth/logout with refreshToken in body", async () => {
    mockFetch(204, undefined);
    await api.logout("at", "rt");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/auth/logout`);
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: "rt" });
  });
});

describe("api.search", () => {
  it("URL-encodes the query parameter", async () => {
    mockFetch(200, []);
    await api.search("breaking bad", "tok");
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toBe(`${BASE}/api/search?q=breaking%20bad`);
  });
});

describe("api.getHistory", () => {
  it("includes type, page, and limit in query string", async () => {
    mockFetch(200, { items: [], total: 0, page: 1, limit: 20 });
    await api.getHistory("tok", "movie", 2, 20);
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("type=movie");
    expect(url).toContain("page=2");
    expect(url).toContain("limit=20");
  });

  it("appends date when provided", async () => {
    mockFetch(200, { items: [], total: 0, page: 1, limit: 20 });
    await api.getHistory("tok", "all", 1, 20, "2025-01-15");
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("date=2025-01-15");
  });
});

describe("api.toggleEpisodeWatched", () => {
  it("sends DELETE when marking unwatched", async () => {
    mockFetch(200, { watched: false, episodeId: 5 });
    await api.toggleEpisodeWatched(1, 1, 1, true, "tok");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });

  it("sends POST when marking watched", async () => {
    mockFetch(200, { watched: true, episodeId: 5 });
    await api.toggleEpisodeWatched(1, 1, 1, false, "tok");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
  });
});

describe("api.upsertRating", () => {
  it("sends POST with mediaType, mediaId, and rating", async () => {
    mockFetch(200, { mediaType: "movie", mediaId: 42, rating: 8 });
    await api.upsertRating("movie", 42, 8, "tok");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/ratings`);
    expect(JSON.parse(init.body as string)).toEqual({ mediaType: "movie", mediaId: 42, rating: 8 });
  });
});

describe("204 / empty-body handling", () => {
  it("resolves to undefined on 204", async () => {
    mockFetch(204, undefined);
    const result = await api.deleteHistory(1, "tok");
    // deleteHistory returns { deleted: boolean } but 204 gives undefined
    expect(result).toBeUndefined();
  });
});

describe("Authorization header", () => {
  it("attaches Bearer token to authenticated requests", async () => {
    mockFetch(200, []);
    await api.getUpNext("my-access-token");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer my-access-token");
  });
});
