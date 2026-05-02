import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockGetProfile = vi.fn();
const mockGetUpNext = vi.fn();
const mockGetSchedule = vi.fn();
const mockGetDashboardStats = vi.fn();
const mockGetRecentItems = vi.fn();
const mockGetStatsAllTime = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    getUpNext: (...args: unknown[]) => mockGetUpNext(...args),
    getSchedule: (...args: unknown[]) => mockGetSchedule(...args),
    getDashboardStats: (...args: unknown[]) => mockGetDashboardStats(...args),
    getRecentItems: (...args: unknown[]) => mockGetRecentItems(...args),
    getStatsAllTime: (...args: unknown[]) => mockGetStatsAllTime(...args),
  },
}));

vi.mock("@/components/up-next-section", () => ({
  UpNextSection: ({ items }: { items: unknown[] }) => (
    <div data-testid="up-next">items: {items.length}</div>
  ),
}));

vi.mock("@/components/schedule-section", () => ({
  ScheduleSection: ({ entries }: { entries: unknown[] }) => (
    <div data-testid="schedule">entries: {entries.length}</div>
  ),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders nothing while loading auth", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ token: null, isLoading: true }),
    }));

    const { default: Page } = await import("../page");
    const { container } = render(<Page />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders up-next and schedule sections after data loads", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ token: "tok", isLoading: false }),
    }));
    mockGetProfile.mockResolvedValue({ id: 1, username: "testuser", displayName: "Test User" });
    mockGetUpNext.mockResolvedValue([]);
    mockGetSchedule.mockResolvedValue([]);
    mockGetDashboardStats.mockResolvedValue([]);
    mockGetRecentItems.mockResolvedValue([]);
    mockGetStatsAllTime.mockResolvedValue({ totalMinutes: 0, totalShows: 0, totalMovies: 0, totalEpisodes: 0, longestStreak: 0, topShows: [], topGenres: [], heatmap: [] });

    const { default: Page } = await import("../page");
    render(<Page />);

    await waitFor(() => expect(screen.getByTestId("up-next")).toBeInTheDocument());
    expect(screen.getByTestId("schedule")).toBeInTheDocument();
  });

  it("shows error message when dashboard fetch fails", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ token: "tok", isLoading: false }),
    }));
    mockGetProfile.mockRejectedValue(new Error("Server error"));
    mockGetUpNext.mockRejectedValue(new Error("Server error"));
    mockGetSchedule.mockRejectedValue(new Error("Server error"));
    mockGetDashboardStats.mockRejectedValue(new Error("Server error"));
    mockGetRecentItems.mockRejectedValue(new Error("Server error"));
    mockGetStatsAllTime.mockRejectedValue(new Error("Server error"));

    const { default: Page } = await import("../page");
    render(<Page />);

    await waitFor(() =>
      expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument()
    );
  });
});
