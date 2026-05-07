import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import MovieDetailPage from "../page";
import type { Movie } from "@trakt/types";

const mockGetMovie = vi.fn();
const mockGetMovieCast = vi.fn();
const mockGetMovieCrew = vi.fn();
const mockToggleWatched = vi.fn();
const mockToggleWatchlist = vi.fn();
const mockToggleCollection = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ token: "test-token", isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ tmdbId: "550" }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getMovie: (...args: unknown[]) => mockGetMovie(...args),
    getMovieCast: (...args: unknown[]) => mockGetMovieCast(...args),
    getMovieCrew: (...args: unknown[]) => mockGetMovieCrew(...args),
    toggleMovieWatched: (...args: unknown[]) => mockToggleWatched(...args),
    toggleMovieWatchlist: (...args: unknown[]) => mockToggleWatchlist(...args),
    toggleMovieCollection: (...args: unknown[]) => mockToggleCollection(...args),
  },
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={props.src as string} alt={props.alt as string} />;
  },
}));

const movie: Movie & { id: number } = {
  id: 1,
  tmdbId: 550,
  title: "Fight Club",
  year: 1999,
  overview: "An insomniac office worker...",
  posterPath: "/poster.jpg",
  backdropPath: "/backdrop.jpg",
  runtimeMin: 139,
  genres: ["Drama", "Thriller"],
};

const status = { inWatchlist: false, inCollection: false, watched: false };

describe("MovieDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMovieCast.mockResolvedValue({ cast: [] });
    mockGetMovieCrew.mockResolvedValue({ crew: [] });
  });

  it("renders movie title, genres, and overview", async () => {
    mockGetMovie.mockResolvedValue({ movie, status });
    render(<MovieDetailPage />);

    await waitFor(() => expect(screen.getByText("Fight Club")).toBeInTheDocument());
    expect(screen.getByText("Drama")).toBeInTheDocument();
    expect(screen.getByText("An insomniac office worker...")).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    mockGetMovie.mockRejectedValue(new Error("Network error"));
    render(<MovieDetailPage />);

    await waitFor(() =>
      expect(screen.getByText(/failed to load movie/i)).toBeInTheDocument()
    );
  });

  it("toggles watched status on button click", async () => {
    mockGetMovie.mockResolvedValue({ movie, status });
    mockToggleWatched.mockResolvedValue({ watched: true });
    render(<MovieDetailPage />);

    await waitFor(() => screen.getByText("Mark Watched"));
    await userEvent.click(screen.getByText("Mark Watched"));

    await waitFor(() =>
      expect(mockToggleWatched).toHaveBeenCalledWith(550, false, "test-token")
    );
  });

  it("toggles watchlist status on button click", async () => {
    mockGetMovie.mockResolvedValue({ movie, status });
    mockToggleWatchlist.mockResolvedValue({ inWatchlist: true });
    render(<MovieDetailPage />);

    await waitFor(() => screen.getByText("Watchlist"));
    await userEvent.click(screen.getByText("Watchlist"));

    expect(mockToggleWatchlist).toHaveBeenCalledWith(550, false, "test-token");
  });
});
