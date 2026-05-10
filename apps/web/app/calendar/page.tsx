"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    setFetching(true);
    api.getSchedule(token, range, filter)
      .then(setEntries)
      .catch(() => setError("Failed to load schedule."))
      .finally(() => setFetching(false));
  }, [token, isLoading, filter, range]);

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;

  const groups = groupByDate(entries);

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-accent text-[10px] font-black uppercase tracking-[0.3em] block mb-2">Premium Tracking</span>
            <h1 className="text-h1 font-black tracking-tight text-white">UPCOMING SCHEDULE</h1>
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex bg-[#181818] p-1 rounded-xl border border-white/5">
              {(["all", "tv", "movie"] as ContentType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                    filter === f ? "bg-accent text-white" : "text-white/40 hover:text-white"
                  }`}
                >
                  {f === "all" ? "All" : f === "tv" ? "Episodes" : "Movies"}
                </button>
              ))}
            </div>
            <select
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
              className="bg-[#181818] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/60 focus:outline-none focus:border-accent transition-colors"
            >
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
              <option value={90}>Next 90 days</option>
            </select>
          </div>
        </header>

        {fetching && <p className="text-white/40">Loadingâ€¦</p>}

        {!fetching && groups.length === 0 && (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-5xl text-white/20 mb-4 block">calendar_today</span>
            <p className="text-white/40">Nothing scheduled in this period.</p>
          </div>
        )}

        <div className="space-y-12">
          {groups.map(([dateStr, dayEntries]) => {
            const { label, sub } = formatDateHeader(dateStr);
            return (
              <section key={dateStr}>
                <div className="flex items-center gap-4 mb-6">
                  <h2 className="text-h2 font-bold text-white">{label}</h2>
                  <span className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                  <span className="text-white/40 text-label-sm uppercase tracking-widest">{sub}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {dayEntries.map((entry, i) => (
                    <CalendarCard key={`${entry.showTmdbId}-${entry.seasonNumber}-${entry.episodeNumber}-${i}`} entry={entry} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalendarCard({ entry }: { entry: ScheduleItem }) {
  const time = entry.date.includes("T")
    ? new Date(entry.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <Link href={`/shows/${entry.showTmdbId}`} className="group relative overflow-hidden rounded-2xl glass-panel block">
      <div className="p-5">
        <p className="text-accent text-[10px] font-black uppercase tracking-widest mb-1">
          {entry.showTitle} Â· S{String(entry.seasonNumber).padStart(2, "0")}E{String(entry.episodeNumber).padStart(2, "0")}
        </p>
        <h3 className="text-white font-bold text-lg leading-tight mb-3 group-hover:text-accent transition-colors line-clamp-2">
          {entry.episodeTitle ?? `Episode ${entry.episodeNumber}`}
        </h3>
        <div className="flex items-center justify-between">
          {time && (
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">{time}</span>
            </div>
          )}
          {entry.network && (
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{entry.network}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

