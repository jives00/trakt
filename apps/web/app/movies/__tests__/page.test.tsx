import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import MoviesPage from "../page";

const mockGetMovieDiscover = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ token: "test-token", isLoading: false }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getMovieDiscover: (...args: unknown[]) => mockGetMovieDiscover(...args),
  },
}));

const nav = vi.hoisted(() => {
  let params = new URLSearchParams();
  const replace = vi.fn((url: string) => {
    params = new URLSearchParams(url.split("?")[1] ?? "");
  });
  return { replace, getParams: () => params, reset: () => { params = new URLSearchParams(); } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => nav.getParams(),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    <img src={props.src as string} alt={props.alt as string} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const response = {
  category: "trending",
  period: "all_time",
  page: 1,
  totalPages: 10,
  totalResults: 100,
  items: [
    {
      tmdbId: 550,
      mediaType: "movie",
      title: "Fight Club",
      year: 1999,
      overview: "An insomniac...",
      posterPath: "/poster.jpg",
      backdropPath: "/backdrop.jpg",
      rating: 84,
      releaseDate: "1999-10-15",
    },
  ],
};

describe("MoviesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.reset();
    mockGetMovieDiscover.mockResolvedValue(response);
  });

  it("renders movie discovery results", async () => {
    render(<MoviesPage />);

    await waitFor(() => expect(screen.getByText("Fight Club")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /fight club/i })).toHaveAttribute("href", "/movies/550");
  });

  it("requests a top-rated period when a period filter is selected", async () => {
    const { rerender } = render(<MoviesPage />);

    await waitFor(() => expect(mockGetMovieDiscover).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: /top rated/i }));
    rerender(<MoviesPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /past year/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /past year/i }));

    await waitFor(() => {
      expect(mockGetMovieDiscover).toHaveBeenCalledWith("top_rated", "test-token", 1, "US", "past_year", null, true);
    });
  });
});
