"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ScheduleItem } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateHeader(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);

  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();

  if (d.getFullYear() === todayYear && d.getMonth() === todayMonth && d.getDate() === todayDay) {
    return "TODAY";
  }

  const tomorrow = new Date(todayYear, todayMonth, todayDay + 1);
  if (d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate()) {
    return "TOMORROW";
  }

  return `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`.toUpperCase();
}

function getNextNDaysWithContent(entries: ScheduleItem[], maxCols = 5, maxDayWindow = 5): string[] {
  const days: string[] = [];
  const usedDates = new Set(entries.map(e => e.date.slice(0, 10)));

  for (let i = 0; i < maxDayWindow && days.length < maxCols; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${date}`;

    if (usedDates.has(dateStr)) {
      days.push(dateStr);
    }
  }

  return days;
}

export function ScheduleSection({ entries }: { entries: ScheduleItem[] }) {
  const days = getNextNDaysWithContent(entries);

  if (days.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-3 text-h2 font-black tracking-tight text-on-surface">
          <span className="block h-8 w-1 rounded-full bg-primary-container" />
          Upcoming Schedule
        </h2>
        <p className="text-on-surface-variant">No upcoming episodes or releases</p>
      </section>
    );
  }

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
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((day, colIndex) => {
          const dayEntries = byDay.get(day) ?? [];
          return (
            <ScheduleColumn
              key={day}
              day={day}
              entries={dayEntries}
              columnIndex={colIndex}
              showPoster={colIndex < 2}
            />
          );
        })}
      </div>
    </section>
  );
}

function ScheduleColumn({
  day,
  entries,
  columnIndex,
  showPoster,
}: {
  day: string;
  entries: ScheduleItem[];
  columnIndex: number;
  showPoster: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const posterEntry = showPoster ? (
    hoveredIndex !== null ? entries[hoveredIndex] : entries[0]
  ) : null;

  const posterPath = posterEntry?.posterPath
    ? `${TMDB_IMG}w400${posterEntry.posterPath}`
    : null;

  return (
    <div className="flex flex-col">
      <div className="text-xs font-black uppercase tracking-widest text-on-surface-variant mb-3">
        {formatDateHeader(day)}
      </div>

      {showPoster && posterPath && (
        <div className="relative aspect-[2/3] mb-3 rounded-lg overflow-hidden border border-white/10">
          <Image
            src={posterPath}
            alt="Show poster"
            fill
            className="object-cover"
            sizes="150px"
          />
        </div>
      )}

      <div className="flex flex-col">
        {entries.map((entry, i) => (
          <div
            key={i}
            onMouseEnter={() => showPoster && entries.length > 1 && setHoveredIndex(i)}
            onMouseLeave={() => showPoster && setHoveredIndex(null)}
            className={showPoster && entries.length > 1 ? "cursor-pointer" : ""}
          >
            {i > 0 && (
              <div className="h-px bg-white/10 my-2" />
            )}

            <ScheduleEntry entry={entry} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleEntry({ entry }: { entry: ScheduleItem }) {
  if (entry.mediaType === "movie") {
    return (
      <Link href={`/movies/${entry.movieTmdbId}`} className="group">
        <p className="text-sm font-bold text-on-surface group-hover:text-primary-container truncate">
          {entry.movieTitle}
        </p>
        <p className="text-xs text-on-surface-variant">
          {entry.date}
        </p>
      </Link>
    );
  }

  return (
    <Link href={`/shows/${entry.showTmdbId}`} className="group">
      <p className="text-sm font-bold text-on-surface group-hover:text-primary-container truncate">
        {entry.showTitle}
      </p>
      <p className="text-xs text-on-surface-variant">
        S{String(entry.seasonNumber).padStart(2, "0")}E{String(entry.episodeNumber).padStart(2, "0")}
        {entry.episodeTitle && ` · ${entry.episodeTitle}`}
      </p>
      {entry.network && (
        <p className="text-xs text-on-surface-variant">{entry.network}</p>
      )}
    </Link>
  );
}
