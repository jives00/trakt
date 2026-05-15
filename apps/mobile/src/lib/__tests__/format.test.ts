import { formatWatchedAt, groupByDay, groupByDate } from "../format";
import type { HistoryItem } from "../api";
import type { ScheduleItem } from "@trakt/types";

function makeHistoryItem(watchedAt: string, id = 1): HistoryItem {
  return {
    id,
    mediaType: "movie",
    tmdbId: 1,
    title: "Test Movie",
    watchedAt,
    posterPath: null,
    showTitle: null,
    seasonNumber: null,
    episodeNumber: null,
  } as unknown as HistoryItem;
}

function makeScheduleItem(date: string, showTmdbId = 1): ScheduleItem {
  return {
    date,
    showTmdbId,
    showTitle: "Test Show",
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: null,
    network: null,
    posterPath: null,
  } as unknown as ScheduleItem;
}

describe("formatWatchedAt", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns 'Just now' for times under 1 hour ago", () => {
    expect(formatWatchedAt("2025-01-15T11:30:00.000Z")).toBe("Just now");
    expect(formatWatchedAt("2025-01-15T11:59:59.000Z")).toBe("Just now");
  });

  it("returns hours ago for times 1–23 hours ago", () => {
    expect(formatWatchedAt("2025-01-15T11:00:00.000Z")).toBe("1h ago");
    expect(formatWatchedAt("2025-01-15T00:00:00.000Z")).toBe("12h ago");
    expect(formatWatchedAt("2025-01-14T13:00:00.000Z")).toBe("23h ago");
  });

  it("returns 'Yesterday' for times exactly 1 day ago", () => {
    expect(formatWatchedAt("2025-01-14T12:00:00.000Z")).toBe("Yesterday");
  });

  it("returns days ago for 2–6 days ago", () => {
    expect(formatWatchedAt("2025-01-13T12:00:00.000Z")).toBe("2 days ago");
    expect(formatWatchedAt("2025-01-09T12:00:00.000Z")).toBe("6 days ago");
  });

  it("returns formatted date for 7+ days ago", () => {
    const result = formatWatchedAt("2025-01-01T12:00:00.000Z");
    expect(result).toBe("Jan 1, 2025");
  });
});

describe("groupByDay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns empty array for no items", () => {
    expect(groupByDay([])).toEqual([]);
  });

  it("groups today's items under 'Today'", () => {
    const items = [
      makeHistoryItem("2025-01-15T08:00:00.000Z", 1),
      makeHistoryItem("2025-01-15T10:00:00.000Z", 2),
    ];
    const result = groupByDay(items);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Today");
    expect(result[0].data).toHaveLength(2);
  });

  it("groups yesterday's items under 'Yesterday'", () => {
    const items = [makeHistoryItem("2025-01-14T10:00:00.000Z", 1)];
    const result = groupByDay(items);
    expect(result[0].title).toBe("Yesterday");
  });

  it("uses day-of-week format for older items", () => {
    const items = [makeHistoryItem("2025-01-10T10:00:00.000Z", 1)];
    const result = groupByDay(items);
    expect(result[0].title).toBe("Friday, January 10");
  });

  it("separates items across different days into distinct groups", () => {
    const items = [
      makeHistoryItem("2025-01-15T08:00:00.000Z", 1),
      makeHistoryItem("2025-01-14T10:00:00.000Z", 2),
      makeHistoryItem("2025-01-10T10:00:00.000Z", 3),
    ];
    const result = groupByDay(items);
    expect(result).toHaveLength(3);
    expect(result.map((g) => g.title)).toEqual(["Today", "Yesterday", "Friday, January 10"]);
  });
});

describe("groupByDate", () => {
  it("returns empty array for no items", () => {
    expect(groupByDate([])).toEqual([]);
  });

  it("groups items on the same date together", () => {
    const items = [
      makeScheduleItem("2025-01-20", 1),
      makeScheduleItem("2025-01-20", 2),
    ];
    const result = groupByDate(items);
    expect(result).toHaveLength(1);
    expect(result[0].data).toHaveLength(2);
  });

  it("uses weekday/month/day format for titles", () => {
    const items = [makeScheduleItem("2025-01-20", 1)];
    const result = groupByDate(items);
    expect(result[0].title).toBe("Monday, January 20");
  });

  it("preserves insertion order across dates", () => {
    const items = [
      makeScheduleItem("2025-01-20", 1),
      makeScheduleItem("2025-01-21", 2),
      makeScheduleItem("2025-01-22", 3),
    ];
    const result = groupByDate(items);
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("Monday, January 20");
    expect(result[1].title).toBe("Tuesday, January 21");
    expect(result[2].title).toBe("Wednesday, January 22");
  });
});
