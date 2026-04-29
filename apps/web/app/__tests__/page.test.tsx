import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import DashboardPage from "../page";

const mockReplace = vi.fn();
const mockGetUpNext = vi.fn();
const mockGetSchedule = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getUpNext: (...args: unknown[]) => mockGetUpNext(...args),
    getSchedule: (...args: unknown[]) => mockGetSchedule(...args),
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

function renderWithAuth(token: string | null, isLoading = false) {
  vi.doMock("@/lib/auth-context", () => ({
    useAuth: () => ({ token, isLoading }),
  }));
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("redirects to /login when not authenticated", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ token: null, isLoading: false }),
    }));

    const { default: Page } = await import("../page");
    render(<Page />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("renders up-next and schedule sections after data loads", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ token: "tok", isLoading: false }),
    }));
    mockGetUpNext.mockResolvedValue([]);
    mockGetSchedule.mockResolvedValue([]);

    const { default: Page } = await import("../page");
    render(<Page />);

    await waitFor(() => expect(screen.getByTestId("up-next")).toBeInTheDocument());
    expect(screen.getByTestId("schedule")).toBeInTheDocument();
  });

  it("shows error message when dashboard fetch fails", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({ token: "tok", isLoading: false }),
    }));
    mockGetUpNext.mockRejectedValue(new Error("Server error"));
    mockGetSchedule.mockRejectedValue(new Error("Server error"));

    const { default: Page } = await import("../page");
    render(<Page />);

    await waitFor(() =>
      expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument()
    );
  });
});
