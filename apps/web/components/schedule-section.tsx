"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
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
  const days = getNextNDaysWithContent(entries, 5, 30);

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
        {days.slice(0, 2).map((day) => {
          const dayEntries = byDay.get(day) ?? [];
          return <ScheduleDayPair key={day} day={day} entries={dayEntries} />;
        })}
        {days.slice(2, 5).map((day) => {
          const dayEntries = byDay.get(day) ?? [];
          return (
            <ScheduleColumn
              key={`info-${day}`}
              day={day}
              entries={dayEntries}
              showHeader={true}
            />
          );
        })}
      </div>
    </section>
  );
}

function entryHref(entry: ScheduleItem): string {
  if (entry.mediaType === "movie") return `/movies/${entry.movieTmdbId}`;
  return `/shows/${entry.showTmdbId}/seasons/${entry.seasonNumber}/episodes/${entry.episodeNumber}`;
}

function ScheduleDayPair({ day, entries }: { day: string; entries: ScheduleItem[] }) {
  const [slotA, setSlotA] = useState<string | null>(null);
  const [slotB, setSlotB] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<"a" | "b">("a");
  const [activeHref, setActiveHref] = useState<string>(entries[0] ? entryHref(entries[0]) : "#");
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initialPath = entries[0]?.posterPath ? `${TMDB_IMG}w154${entries[0].posterPath}` : null;
    setSlotA(initialPath);
  }, [entries]);

  const handleHover = (i: number) => {
    const newPath = entries[i]?.posterPath ? `${TMDB_IMG}w154${entries[i].posterPath}` : null;
    setActiveHref(entries[i] ? entryHref(entries[i]) : "#");

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    if (activeSlot === "a") {
      setSlotB(newPath);
      transitionTimeoutRef.current = setTimeout(() => {
        setActiveSlot("b");
        transitionTimeoutRef.current = null;
      }, 50);
    } else {
      setSlotA(newPath);
      transitionTimeoutRef.current = setTimeout(() => {
        setActiveSlot("a");
        transitionTimeoutRef.current = null;
      }, 50);
    }
  };

  const hasPoster = slotA || slotB;

  return (
    <>
      <div className="flex flex-col">
        <div className="text-sm font-black uppercase tracking-widest text-on-surface-variant mb-2">
          {formatDateHeader(day)}
        </div>
        {hasPoster && (
          <Link href={activeHref} className="relative aspect-[2/3] overflow-hidden border border-outline-variant/40 block">
            {slotA && (
              <Image
                src={slotA}
                alt="Show poster"
                fill
                className={`object-cover absolute inset-0 transition-opacity duration-500 ${activeSlot === "a" ? "opacity-100" : "opacity-0"}`}
                sizes="80px"
              />
            )}
            {slotB && (
              <Image
                src={slotB}
                alt="Show poster"
                fill
                className={`object-cover absolute inset-0 transition-opacity duration-500 ${activeSlot === "b" ? "opacity-100" : "opacity-0"}`}
                sizes="80px"
              />
            )}
          </Link>
        )}
      </div>
      <ScheduleColumn day={day} entries={entries} onHover={handleHover} />
    </>
  );
}

function ScheduleColumn({
  day,
  entries,
  showHeader = false,
  onHover,
}: {
  day: string;
  entries: ScheduleItem[];
  showHeader?: boolean;
  onHover?: (i: number) => void;
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
          <div key={i} onMouseEnter={() => onHover?.(i)}>
            {i > 0 && (
              <div className="h-px bg-on-surface/10 my-4" />
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
        <p className="text-lg font-bold leading-tight text-on-surface group-hover:text-primary-container">
          {entry.movieTitle}
        </p>
        {entry.movieTagline && (
          <p className="text-xs text-on-surface-variant">{entry.movieTagline}</p>
        )}
      </Link>
    );
  }

  const episodeHref = `/shows/${entry.showTmdbId}/seasons/${entry.seasonNumber}/episodes/${entry.episodeNumber}`;
  const showHref = `/shows/${entry.showTmdbId}`;
  const isSeasonPremiere = entry.episodeNumber === 1;
  const isSeasonFinale = entry.episodeType === "finale";

  return (
    <div>
      <Link href={showHref} className="group">
        <p className="text-lg font-bold leading-tight text-on-surface group-hover:text-primary-container mb-1">
          {entry.showTitle}
        </p>
      </Link>
      <div className="flex flex-col gap-1 mb-1">
        {(isSeasonPremiere || isSeasonFinale) && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
            {isSeasonPremiere ? 'Premiere' : 'Finale'}
          </span>
        )}
        <Link href={episodeHref} className="group">
          <p className="text-xs text-on-surface-variant group-hover:text-primary-container">
            S{String(entry.seasonNumber).padStart(2, "0")}E{String(entry.episodeNumber).padStart(2, "0")}
            {entry.episodeTitle && ` · ${entry.episodeTitle}`}
          </p>
        </Link>
      </div>
      {(entry.airTime || entry.network) && (
        <p className="text-xs text-on-surface-variant">
          {entry.airTime && formatTime(entry.airTime)} {entry.airTime && entry.network ? 'on' : ''} {entry.network}
        </p>
      )}
    </div>
  );
}
