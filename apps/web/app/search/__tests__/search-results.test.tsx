import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { SearchResults } from "../search-results";
import type { SearchResult } from "@trakt/types";

const mockSearch = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ token: "test-token", isLoading: false }),
}));

vi.mock("@/lib/api", () => ({
  api: { search: (...args: unknown[]) => mockSearch(...args) },
  ApiError: class ApiError extends Error {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

const results: SearchResult[] = [
  { tmdbId: 550, mediaType: "movie", title: "Fight Club", year: 1999, posterPath: "/poster.jpg", overview: "..." },
  { tmdbId: 1396, mediaType: "show", title: "Breaking Bad", year: 2008, posterPath: null, overview: "..." },
];

describe("SearchResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a search input", () => {
    render(<SearchResults />);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("shows results after search", async () => {
    mockSearch.mockResolvedValue(results);
    render(<SearchResults />);

    await userEvent.type(screen.getByRole("searchbox"), "fight");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByText("Fight Club")).toBeInTheDocument());
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
  });

  it("shows movie and show type badges", async () => {
    mockSearch.mockResolvedValue(results);
    render(<SearchResults />);

    await userEvent.type(screen.getByRole("searchbox"), "fight");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByText("Movie")).toBeInTheDocument());
    expect(screen.getByText("Show")).toBeInTheDocument();
  });

  it("results link to the correct detail pages", async () => {
    mockSearch.mockResolvedValue(results);
    render(<SearchResults />);

    await userEvent.type(screen.getByRole("searchbox"), "fight");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      const movieLink = screen.getByRole("link", { name: /fight club/i });
      expect(movieLink).toHaveAttribute("href", "/movies/550");
      const showLink = screen.getByRole("link", { name: /breaking bad/i });
      expect(showLink).toHaveAttribute("href", "/shows/1396");
    });
  });

  it("shows empty state when no results", async () => {
    mockSearch.mockResolvedValue([]);
    render(<SearchResults />);

    await userEvent.type(screen.getByRole("searchbox"), "xyznotfound");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByText(/no results/i)).toBeInTheDocument());
  });
});
