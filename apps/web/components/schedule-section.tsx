"use client";

import Link from "next/link";
import type { ScheduleItem } from "@trakt/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function next7Days(): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function ScheduleSection({ entries }: { entries: ScheduleItem[] }) {
  const days = next7Days();
  const byDay = new Map<string, ScheduleItem[]>();
  for (const e of entries) {
    const key = e.date.slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-3 text-h2 font-black tracking-tight text-on-surface">
        <span className="block h-8 w-1 rounded-full bg-primary-container" />
        Upcoming Schedule
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {days.slice(0, 4).map((day) => {
          const dayEntries = byDay.get(day) ?? [];
          const today = isToday(day);
          return (
            <div
              key={day}
              className={`rounded-xl border-t-2 bg-surface-container-low p-4 ${today ? "border-primary-container" : "border-outline-variant"}`}
            >
              <p className={`mb-3 text-label-sm uppercase tracking-widest ${today ? "text-primary-container" : "text-on-surface-variant"}`}>
                {today ? "Today" : formatDay(day)}
              </p>
              {dayEntries.length === 0 ? (
                <p className="text-xs text-on-surface-variant">No episodes</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {dayEntries.map((e, i) => (
                    <li key={i} className="border-l border-outline-variant pl-3">
                      <Link
                        href={`/shows/${e.showTmdbId}`}
                        className="block text-sm font-bold text-on-surface truncate hover:text-primary-container"
                      >
                        {e.showTitle}
                      </Link>
                      <p className="text-label-sm uppercase tracking-widest text-on-surface-variant">
                        S{e.seasonNumber}E{e.episodeNumber}
                        {e.network ? ` · ${e.network}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
