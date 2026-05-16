import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ShowsPage from "../page";

const mockGetShowDiscover = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ token: "test-token", isLoading: false }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getShowDiscover: (...args: unknown[]) => mockGetShowDiscover(...args),
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
      tmdbId: 1396,
      mediaType: "show",
      title: "Breaking Bad",
      year: 2008,
      overview: "A chemistry teacher...",
      posterPath: "/bb.jpg",
      backdropPath: "/bb-bg.jpg",
      rating: 89,
      releaseDate: "2008-01-20",
    },
  ],
};

describe("ShowsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.reset();
    mockGetShowDiscover.mockResolvedValue(response);
  });

  it("renders show discovery results", async () => {
    render(<ShowsPage />);

    await waitFor(() => expect(screen.getByText("Breaking Bad")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /breaking bad/i })).toHaveAttribute("href", "/shows/1396");
  });

  it("requests a top-rated period when a period filter is selected", async () => {
    const { rerender } = render(<ShowsPage />);

    await waitFor(() => expect(mockGetShowDiscover).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: /top rated/i }));
    rerender(<ShowsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /past year/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /past year/i }));

    await waitFor(() => {
      expect(mockGetShowDiscover).toHaveBeenCalledWith("top_rated", "test-token", 1, "past_year");
    });
  });
});
