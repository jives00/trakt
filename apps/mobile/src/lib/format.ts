import type { HistoryItem } from "./api";
import type { ScheduleItem } from "@trakt/types";

export function formatWatchedAt(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Yesterday";
  if (diffD < 7) return `${diffD} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function groupByDay(items: HistoryItem[]): { title: string; data: HistoryItem[] }[] {
  const groups = new Map<string, HistoryItem[]>();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  for (const item of items) {
    const d = new Date(item.watchedAt);
    let key: string;
    if (d.toDateString() === now.toDateString()) key = "Today";
    else if (d.toDateString() === yesterday.toDateString()) key = "Yesterday";
    else key = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

export function groupByDate(items: ScheduleItem[]): { title: string; data: ScheduleItem[] }[] {
  const groups = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const d = new Date(item.date + "T00:00:00"); // parse as local midnight, not UTC
    const key = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}
