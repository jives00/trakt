"use client";

import Image from "next/image";
import Link from "next/link";
import type { ScheduleItem } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return '';
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  const displayMins = minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`;
  return `${displayHours}${displayMins}${period}`;
}

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

function getNextNDaysWithContent(entries: ScheduleItem[], maxDisplay = 7, maxDayWindow = 30): string[] {
  const days: string[] = [];
  const usedDates = new Set(entries.map(e => e.date.slice(0, 10)));

  // Collect all days with content in the next 30 days
  for (let i = 0; i < maxDayWindow; i++) {
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

  // Return up to maxDisplay days
  return days.slice(0, maxDisplay);
}

export function ScheduleSection({ entries }: { entries: ScheduleItem[] }) {
  const days = getNextNDaysWithContent(entries, 5, 6);

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
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(7, minmax(0, 1fr))` }}>
        {/* Interleave poster/info for first 2 days, then info for remaining days */}
        {[
          ...days.slice(0, 2).flatMap((day) => {
            const dayEntries = byDay.get(day) ?? [];
            const posterEntry = dayEntries[0];
            const posterPath = posterEntry?.posterPath
              ? `${TMDB_IMG}w154${posterEntry.posterPath}`
              : null;
            return [
              <div key={`poster-${day}`} className="flex flex-col">
                <div className="text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">
                  {formatDateHeader(day)}
                </div>
                {posterPath && (
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-white/10">
                    <Image
                      src={posterPath}
                      alt="Show poster"
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>
                )}
              </div>,
              <ScheduleColumn
                key={`info-${day}`}
                day={day}
                entries={dayEntries}
              />,
            ];
          }),
          ...days.slice(2, 5).map((day) => {
            const dayEntries = byDay.get(day) ?? [];
            return (
              <ScheduleColumn
                key={`info-${day}`}
                day={day}
                entries={dayEntries}
                showHeader={true}
              />
            );
          }),
        ]}
      </div>
    </section>
  );
}

function ScheduleColumn({
  day,
  entries,
  showHeader = false,
}: {
  day: string;
  entries: ScheduleItem[];
  showHeader?: boolean;
}) {
  return (
    <div className="flex flex-col">
      {showHeader && (
        <div className="text-sm font-black uppercase tracking-widest text-on-surface-variant mb-2">
          {formatDateHeader(day)}
        </div>
      )}

      <div className={`flex flex-col ${!showHeader ? 'mt-6' : ''}`}>
        {entries.map((entry, i) => (
          <div key={i}>
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
        <p className="text-lg font-bold text-on-surface group-hover:text-primary-container">
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
      <p className="text-lg font-bold text-on-surface group-hover:text-primary-container">
        {entry.showTitle}
      </p>
      <p className="text-xs text-on-surface-variant">
        S{String(entry.seasonNumber).padStart(2, "0")}E{String(entry.episodeNumber).padStart(2, "0")}
        {entry.episodeTitle && ` · ${entry.episodeTitle}`}
      </p>
      {(entry.airTime || entry.network) && (
        <p className="text-xs text-on-surface-variant">
          {entry.airTime && formatTime(entry.airTime)} {entry.airTime && entry.network ? 'on' : ''} {entry.network}
        </p>
      )}
    </Link>
  );
}
