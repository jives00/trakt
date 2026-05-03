import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ShowDetailPage from "../page";

const mockGetShow = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ token: "test-token", isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ tmdbId: "1396" }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getShow: (...args: unknown[]) => mockGetShow(...args),
    getSeason: vi.fn(),
    toggleShowWatchlist: vi.fn().mockResolvedValue({ inWatchlist: true }),
    toggleShowCollection: vi.fn().mockResolvedValue({ inCollection: true }),
    toggleEpisodeWatched: vi.fn().mockResolvedValue({ watched: true }),
    getShowUpNext: vi.fn().mockResolvedValue({ episode: null }),
    getShowRecentEpisodes: vi.fn().mockResolvedValue({ episodes: [] }),
    getShowCast: vi.fn().mockResolvedValue({ cast: [] }),
    getShowSeasons: vi.fn().mockResolvedValue({ seasons: [] }),
    upsertRating: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={props.src as string} alt={props.alt as string} />;
  },
}));

const show = {
  id: 1,
  tmdbId: 1396,
  title: "Breaking Bad",
  year: 2008,
  overview: "A chemistry teacher...",
  posterPath: "/bb.jpg",
  backdropPath: "/bb-bg.jpg",
  status: "Ended",
  network: "AMC",
  genres: ["Drama"],
  seasonCount: 5,
};

const status = { inWatchlist: false, inCollection: false };

describe("ShowDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders show title, year, network, and overview", async () => {
    mockGetShow.mockResolvedValue({ show, status });
    render(<ShowDetailPage />);

    await waitFor(() => expect(screen.getByText("Breaking Bad")).toBeInTheDocument());
    expect(screen.getAllByText("AMC").length).toBeGreaterThan(0);
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(screen.getByText("A chemistry teacher...")).toBeInTheDocument();
  });

  it("renders season cards when seasons are returned", async () => {
    mockGetShow.mockResolvedValue({ show, status });
    const { api } = await import("@/lib/api");
    (api.getShowSeasons as ReturnType<typeof vi.fn>).mockResolvedValue({
      seasons: [
        { seasonNumber: 1, episodeCount: 7, posterPath: null },
        { seasonNumber: 5, episodeCount: 16, posterPath: null },
      ],
    });
    render(<ShowDetailPage />);

    await waitFor(() => expect(screen.getByText("Season 1")).toBeInTheDocument());
    expect(screen.getByText("Season 5")).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    mockGetShow.mockRejectedValue(new Error("Not found"));
    render(<ShowDetailPage />);

    await waitFor(() =>
      expect(screen.getByText(/failed to load show/i)).toBeInTheDocument()
    );
  });
});
