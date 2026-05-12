"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ScheduleItem } from "@trakt/types";

export const dynamic = "force-dynamic";

const TMDB_IMG = "https://image.tmdb.org/t/p/";
type ContentType = "all" | "tv" | "movie";

function groupByDate(entries: ScheduleItem[]): [string, ScheduleItem[]][] {
  const groups = new Map<string, ScheduleItem[]>();
  for (const entry of entries) {
    const date = entry.date.split("T")[0];
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(entry);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function formatDateHeader(dateStr: string): { label: string; sub: string } {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = dateStr === today.toISOString().split("T")[0];
  const isTomorrow = dateStr === tomorrow.toISOString().split("T")[0];

  const label = isToday ? "TODAY" : isTomorrow ? "TOMORROW"
    : date.toLocaleDateString(undefined, { weekday: "long" }).toUpperCase();
  const sub = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return { label, sub };
}

export default function CalendarPage() {
  const { token, isLoading } = useAuth();
  const [entries, setEntries] = useState<ScheduleItem[]>([]);
  const [filter, setFilter] = useState<ContentType>("all");
  const [range, setRange] = useState(14);
  const [startDays, setStartDays] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading || !token) return;
    setFetching(true);
    api.getSchedule(token, range, filter, startDays)
      .then(setEntries)
      .catch(() => setError("Failed to load schedule."))
      .finally(() => setFetching(false));
  }, [token, isLoading, filter, range, startDays]);

  useEffect(() => {
    if (!fetching && startDays > 0) {
      setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [fetching, startDays]);

  const handleFilterChange = (f: ContentType) => {
    setStartDays(0);
    setFilter(f);
  };

  const handleRangeChange = (r: number) => {
    setStartDays(0);
    setRange(r);
  };

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;

  const groups = groupByDate(entries);

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div ref={contentRef}>
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-accent text-[10px] font-black uppercase tracking-[0.3em] block mb-2">Premium Tracking</span>
            <h1 className="text-h1 font-black tracking-tight text-on-surface">UPCOMING SCHEDULE</h1>
          </div>
          <div className="flex gap-2 items-center">
            {(["all", "tv", "movie"] as ContentType[]).map((f) => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={`px-3 py-2 rounded-full text-sm transition-colors ${
                  filter === f ? "bg-accent text-white" : "bg-surface-container-low border border-white/10 text-on-surface-variant/70 hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                {f === "all" ? "All Media" : f === "tv" ? "Episodes" : "Movies"}
              </button>
            ))}
            <select
              value={range}
              onChange={(e) => handleRangeChange(Number(e.target.value))}
              className="bg-surface-container-low border border-white/10 rounded-full px-3 py-2 text-sm text-on-surface-variant/70 focus:outline-none focus:border-accent transition-colors"
            >
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
              <option value={90}>Next 90 days</option>
            </select>
          </div>
        </header>

        {fetching && <p className="text-on-surface-variant/70">Loading…</p>}

        {!fetching && groups.length === 0 && (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block">calendar_today</span>
            <p className="text-on-surface-variant/70">Nothing scheduled in this period.</p>
          </div>
        )}

        <div>
          {groups.map(([dateStr, dayEntries]) => {
            const { label, sub } = formatDateHeader(dateStr);
            return (
              <div key={dateStr} className="grid grid-cols-[8rem_1fr] gap-x-8 gap-y-0 mb-10">
                <div className="pt-1">
                  <span className="font-sans uppercase tracking-widest text-sm font-bold text-on-surface block">{label}</span>
                  <span className="font-sans uppercase tracking-widest text-xs text-on-surface-variant/40 block mt-1">{sub}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {dayEntries.map((entry, i) => (
                    <CalendarCard
                      key={entry.mediaType === "movie" ? `movie-${entry.movieTmdbId}-${i}` : `ep-${entry.showTmdbId}-${entry.seasonNumber}-${entry.episodeNumber}`}
                      entry={entry}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {!fetching && (
            <div className="mt-12 flex justify-center gap-4">
              {startDays > 0 && (
                <button
                  onClick={() => setStartDays(0)}
                  className="flex items-center gap-2 px-6 py-3 bg-surface-container-low border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:text-on-surface hover:border-white/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">home</span>
                  Back to Today
                </button>
              )}
              <button
                onClick={() => setStartDays(startDays + range)}
                className="flex items-center gap-2 px-6 py-3 bg-surface-container-low border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:text-on-surface hover:border-white/20 transition-colors"
              >
                <span className="material-symbols-outlined text-base">arrow_forward</span>
                View Next {range} Days
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatAirTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${period}`;
}

function CalendarCard({ entry }: { entry: ScheduleItem }) {
  const backdropUrl = entry.backdropPath ? `${TMDB_IMG}w780${entry.backdropPath}` : null;
  const href = entry.mediaType === "movie" ? `/movies/${entry.movieTmdbId}` : `/shows/${entry.showTmdbId}`;

  return (
    <Link href={href} className="group relative overflow-hidden block aspect-video">
      {backdropUrl ? (
        <Image
          src={backdropUrl}
          alt={entry.mediaType === "movie" ? (entry.movieTitle ?? "") : (entry.showTitle ?? "")}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
        />
      ) : (
        <div className="absolute inset-0 bg-surface-container-low" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 via-40% to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        {entry.mediaType === "episode" ? (
          <EpisodeCardContent entry={entry} />
        ) : (
          <MovieCardContent entry={entry} />
        )}
      </div>
    </Link>
  );
}

function EpisodeCardContent({ entry }: { entry: ScheduleItem }) {
  return (
    <>
      <p className="font-sans uppercase tracking-widest text-sm font-bold text-accent mb-1">
        {entry.showTitle}
      </p>
      <h3 className="text-white font-bold text-base leading-tight mb-2 line-clamp-1">
        S{String(entry.seasonNumber).padStart(2, "0")}E{String(entry.episodeNumber).padStart(2, "0")}
        {entry.episodeTitle ? ` · ${entry.episodeTitle}` : ""}
      </h3>
      <div className="flex items-center gap-3">
        {entry.airTime && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
            {formatAirTime(entry.airTime)}
          </span>
        )}
        {entry.network && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
            {entry.network}
          </span>
        )}
      </div>
    </>
  );
}

function MovieCardContent({ entry }: { entry: ScheduleItem }) {
  return (
    <>
      <p className="font-sans uppercase tracking-widest text-sm font-bold text-accent mb-1">
        Movie
      </p>
      <h3 className="text-white font-bold text-base leading-tight mb-1 line-clamp-1">
        {entry.movieTitle}
      </h3>
      {entry.movieTagline && (
        <p className="text-white/50 text-xs line-clamp-1">{entry.movieTagline}</p>
      )}
    </>
  );
}


