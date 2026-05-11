"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { HistoryItem } from "@trakt/types";

export const dynamic = "force-dynamic";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

function formatWatchedAt(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 24) return diffH <= 1 ? "Just now" : `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Yesterday";
  if (diffD < 7) return `${diffD} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function groupByDay(items: HistoryItem[]): [string, HistoryItem[]][] {
  const groups = new Map<string, HistoryItem[]>();
  for (const item of items) {
    const d = new Date(item.watchedAt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const key = isToday ? "Today" : isYesterday ? "Yesterday"
      : d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries());
}

const SOURCE_COLORS: Record<string, string> = {
  emby: "text-accent",
  kodi: "text-[#2a9d8f]",
  stremio: "text-[#8a2be2]",
  manual: "text-white/40",
};

type FilterType = "all" | "movie" | "episode";

export default function HistoryPage() {
  const { token, isLoading } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (t: string, f: FilterType, p: number, reset = false) => {
    setFetching(true);
    try {
      const data = await api.getHistory(t, f, p);
      setItems((prev) => reset ? data.items : [...prev, ...data.items]);
      setTotal(data.total);
    } catch {
      setError("Failed to load history.");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading || !token) return;
    load(token, filter, 1, true);
    setPage(1);
  }, [token, isLoading, filter, load]);

  async function handleDelete(id: number) {
    if (!token) return;
    await api.deleteHistory(id, token);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setTotal((t) => t - 1);
  }

  async function loadMore() {
    if (!token) return;
    const next = page + 1;
    setPage(next);
    await load(token, filter, next);
  }

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;

  const groups = groupByDay(items);
  const hasMore = items.length < total;

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <header className="mb-8">
        <h1 className="text-h1 font-black tracking-tight text-white mb-1">History</h1>
        <p className="text-white/40">Your cinematic journey, chronologically curated.</p>
      </header>

      <div className="flex gap-2 mb-8">
        {(["all", "movie", "episode"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
              filter === f
                ? "bg-accent text-white"
                : "bg-[#181818] text-white/40 border border-white/10 hover:text-white"
            }`}
          >
            {f === "all" ? "All" : f === "movie" ? "Movies" : "Episodes"}
          </button>
        ))}
      </div>

      {fetching && items.length === 0 && (
        <p className="text-white/40">Loading...</p>
      )}

      {groups.map(([day, dayItems]) => (
        <section key={day} className="mb-10">
          <div className="flex items-center gap-4 mb-5">
            <h2 className="text-h2 font-bold text-white">{day}</h2>
            <div className="h-px flex-grow bg-white/5" />
            <span className="text-xs font-bold uppercase tracking-widest text-accent">
              {dayItems.length} {dayItems.length === 1 ? "ITEM" : "ITEMS"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {dayItems.map((item) => (
              <HistoryCard key={item.id} item={item} onDelete={() => handleDelete(item.id)} />
            ))}
          </div>
        </section>
      ))}

      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMore}
            disabled={fetching}
            className="px-6 py-3 rounded-lg bg-[#181818] border border-white/10 text-white/60 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
          >
            {fetching ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {!fetching && items.length === 0 && (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-white/20 mb-4 block">history</span>
          <p className="text-white/40">No watch history yet.</p>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ item, onDelete }: { item: HistoryItem; onDelete: () => void }) {
  const isEpisode = item.mediaType === "episode";
  const posterUrl = item.posterPath ? `${TMDB_IMG}w185${item.posterPath}` : null;

  return (
    <div className="glass-panel rounded-xl overflow-hidden group red-glow-hover transition-all duration-300">
      <div className="flex h-44">
        <div className="w-32 relative flex-shrink-0 bg-[#181818] group/img">
          {posterUrl ? (
            <Image src={posterUrl} alt={item.title ?? ""} fill className="object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="material-symbols-outlined text-3xl text-white/20">
                {isEpisode ? "tv" : "movie"}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
          </div>
        </div>
        <div className="flex-grow p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base leading-tight text-white line-clamp-1 mb-1">
              {isEpisode ? item.showTitle : item.title}
            </h3>
            {isEpisode && item.seasonNumber != null && item.episodeNumber != null && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-accent font-bold">
                  S{String(item.seasonNumber).padStart(2, "0")} &middot; E{String(item.episodeNumber).padStart(2, "0")}
                </span>
                {item.title && (
                  <span className="text-[11px] text-white/60 truncate">{item.title}</span>
                )}
              </div>
            )}
            {!isEpisode && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-white/40 font-bold uppercase">Movie</span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded">
                <span className="material-symbols-outlined text-xs text-white/20">star</span>
                <span className="text-xs font-bold text-white/40">&ndash;</span>
              </div>
              <div className="bg-[#2a2a2a] px-2 py-1 rounded border border-white/5">
                <span className={`text-[9px] font-black tracking-tighter uppercase ${SOURCE_COLORS[item.source] ?? "text-white/40"}`}>
                  {item.source}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <span className="text-[10px] text-white/40">{formatWatchedAt(item.watchedAt)}</span>
            <button
              onClick={onDelete}
              className="text-white/20 hover:text-accent transition-colors material-symbols-outlined text-lg"
              aria-label="Delete history entry"
            >
              delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
