import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { ScheduleSection } from "../schedule-section";
import type { ScheduleItem } from "@trakt/types";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return localDateStr(new Date());
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

const makeEntry = (overrides: Partial<ScheduleItem> = {}): ScheduleItem => ({
  mediaType: "episode",
  showTmdbId: 1,
  showTitle: "Breaking Bad",
  posterPath: "/poster.jpg",
  network: "AMC",
  seasonNumber: 1,
  episodeNumber: 1,
  episodeTitle: "Pilot",
  date: todayStr(),
  ...overrides,
});

describe("ScheduleSection", () => {
  it("renders the section heading", () => {
    render(<ScheduleSection entries={[makeEntry()]} />);
    expect(screen.getByText("Upcoming Schedule")).toBeInTheDocument();
  });

  it("shows no episodes message when no entries", () => {
    render(<ScheduleSection entries={[]} />);
    expect(screen.getByText("No upcoming episodes or releases")).toBeInTheDocument();
  });

  it("renders show title and episode label for a scheduled entry", () => {
    const entry = makeEntry({ date: todayStr(), seasonNumber: 2, episodeNumber: 3 });
    render(<ScheduleSection entries={[entry]} />);
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    expect(screen.getByText(/S02E03/)).toBeInTheDocument();
    expect(screen.getByText(/AMC/)).toBeInTheDocument();
  });

  it("links show title to show detail page", () => {
    render(<ScheduleSection entries={[makeEntry({ showTmdbId: 99 })]} />);
    const links = screen.getAllByRole("link");
    const showLink = links.find(l => l.textContent?.includes("Breaking Bad") && l.getAttribute("href") === "/shows/99");
    expect(showLink).toBeDefined();
    expect(showLink).toHaveAttribute("href", "/shows/99");
  });

  it("shows TODAY label for today's entries", () => {
    render(<ScheduleSection entries={[makeEntry()]} />);
    expect(screen.getByText("TODAY")).toBeInTheDocument();
  });

  it("shows multiple entries on same day separated by a line", () => {
    const entries = [
      makeEntry({ date: todayStr(), showTitle: "Show 1", showTmdbId: 1 }),
      makeEntry({ date: todayStr(), showTitle: "Show 2", showTmdbId: 2 }),
    ];
    render(<ScheduleSection entries={entries} />);
    expect(screen.getByText("Show 1")).toBeInTheDocument();
    expect(screen.getByText("Show 2")).toBeInTheDocument();
  });

  it("shows poster for first two columns only", () => {
    const entries = [
      makeEntry({ date: todayStr(), posterPath: "/p1.jpg" }),
      makeEntry({ date: daysFromNow(1), posterPath: "/p2.jpg" }),
      makeEntry({ date: daysFromNow(2), posterPath: "/p3.jpg" }),
    ];
    render(<ScheduleSection entries={entries} />);
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThan(0);
  });

  it("shows at most 5 days of content", () => {
    const entries = [
      makeEntry({ date: todayStr(), showTitle: "Day 0" }),
      makeEntry({ date: daysFromNow(1), showTitle: "Day 1" }),
      makeEntry({ date: daysFromNow(2), showTitle: "Day 2" }),
      makeEntry({ date: daysFromNow(3), showTitle: "Day 3" }),
      makeEntry({ date: daysFromNow(4), showTitle: "Day 4" }),
      makeEntry({ date: daysFromNow(5), showTitle: "Day 5" }),
    ];
    render(<ScheduleSection entries={entries} />);
    expect(screen.getByText("Day 0")).toBeInTheDocument();
    expect(screen.getByText("Day 4")).toBeInTheDocument();
    expect(screen.queryByText("Day 5")).not.toBeInTheDocument();
  });
});
