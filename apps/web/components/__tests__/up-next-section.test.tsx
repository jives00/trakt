import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { UpNextSection } from "../up-next-section";
import { AuthProvider } from "@/lib/auth-context";
import type { UpNextItem } from "@trakt/types";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/",
}));

const makeItem = (overrides: Partial<UpNextItem> = {}): UpNextItem => ({
  showTmdbId: 1,
  showTitle: "Test Show",
  posterPath: null,
  backdropPath: null,
  seasonNumber: 1,
  episodeNumber: 2,
  episodeId: 99,
  episodeTitle: "Pilot",
  airDate: null,
  totalAired: 5,
  watchedCount: 0,
  ...overrides,
});

describe("UpNextSection", () => {
  it("shows empty state when no items", () => {
    render(
      <AuthProvider>
        <UpNextSection items={[]} />
      </AuthProvider>
    );
    expect(screen.getByText(/no shows tracked yet/i)).toBeInTheDocument();
    expect(screen.getByText(/search for a show/i)).toBeInTheDocument();
  });

  it("renders a card for each item", () => {
    const items = [
      makeItem({ showTitle: "Show A", episodeId: 1 }),
      makeItem({ showTitle: "Show B", episodeId: 2 }),
    ];
    render(
      <AuthProvider>
        <UpNextSection items={items} />
      </AuthProvider>
    );
    expect(screen.getAllByText("Show A")).toHaveLength(2); // placeholder + label
    expect(screen.getAllByText("Show B")).toHaveLength(2);
  });

  it("links to the episode detail page", () => {
    render(
      <AuthProvider>
        <UpNextSection items={[makeItem({ showTmdbId: 42, seasonNumber: 1, episodeNumber: 2 })]} />
      </AuthProvider>
    );
    const episodeLink = screen.getByRole("link", { name: /s1e2/i });
    expect(episodeLink).toHaveAttribute("href", "/shows/42/seasons/1/episodes/2");
  });

  it("shows episode label", () => {
    render(
      <AuthProvider>
        <UpNextSection items={[makeItem({ seasonNumber: 2, episodeNumber: 5, episodeTitle: "The One" })]} />
      </AuthProvider>
    );
    expect(screen.getByText(/S2E5/)).toBeInTheDocument();
    expect(screen.getByText(/The One/)).toBeInTheDocument();
  });
});
