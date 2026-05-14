import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { TopNav } from "../top-nav";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    token: "test-token",
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    search: vi.fn(),
  },
}));

describe("TopNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the TRAKT logo link", () => {
    render(<TopNav />);
    expect(screen.getByText("TRAKT")).toBeInTheDocument();
  });

  it("renders top nav links", () => {
    render(<TopNav />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Movies")).toBeInTheDocument();
    expect(screen.getByText("Shows")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
  });

  it("opens dropdown menu when avatar is clicked", () => {
    render(<TopNav />);
    const avatarButton = screen.getByAltText("User avatar").closest("button");
    fireEvent.click(avatarButton!);
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("Lists")).toBeInTheDocument();
    expect(screen.getByText("Stats")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("logo links to /", () => {
    render(<TopNav />);
    const logo = screen.getByText("TRAKT").closest("a");
    expect(logo).toHaveAttribute("href", "/");
  });

  it("renders search input with placeholder", () => {
    render(<TopNav />);
    const searchInput = screen.getByPlaceholderText("Search movies and shows…");
    expect(searchInput).toBeInTheDocument();
  });

  it("renders avatar image", () => {
    render(<TopNav />);
    const avatar = screen.getByAltText("User avatar");
    expect(avatar).toBeInTheDocument();
  });
});
