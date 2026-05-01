import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { ScheduleSection } from "../schedule-section";
import type { ScheduleItem } from "@trakt/types";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const makeEntry = (overrides: Partial<ScheduleItem> = {}): ScheduleItem => ({
  showTmdbId: 1,
  showTitle: "Breaking Bad",
  network: "AMC",
  seasonNumber: 1,
  episodeNumber: 1,
  episodeTitle: "Pilot",
  date: todayStr(),
  ...overrides,
});

describe("ScheduleSection", () => {
  it("renders the section heading", () => {
    render(<ScheduleSection entries={[]} />);
    expect(screen.getByText("Upcoming Schedule")).toBeInTheDocument();
  });

  it("shows 4 day columns", () => {
    render(<ScheduleSection entries={[]} />);
    const noEpisodeMessages = screen.getAllByText("No episodes");
    expect(noEpisodeMessages).toHaveLength(4);
  });

  it("shows 'Today' label for today's column", () => {
    render(<ScheduleSection entries={[]} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("renders show title and episode label for a scheduled entry", () => {
    const entry = makeEntry({ date: todayStr(), seasonNumber: 2, episodeNumber: 3 });
    render(<ScheduleSection entries={[entry]} />);
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    expect(screen.getByText(/S2E3/)).toBeInTheDocument();
    expect(screen.getByText(/AMC/)).toBeInTheDocument();
  });

  it("links show title to show detail page", () => {
    render(<ScheduleSection entries={[makeEntry({ showTmdbId: 99 })]} />);
    const link = screen.getByRole("link", { name: "Breaking Bad" });
    expect(link).toHaveAttribute("href", "/shows/99");
  });

  it("entries beyond 4 days are not shown", () => {
    const entries = [
      makeEntry({ date: daysFromNow(5), showTitle: "Far Future Show" }),
    ];
    render(<ScheduleSection entries={entries} />);
    expect(screen.queryByText("Far Future Show")).not.toBeInTheDocument();
  });
});
