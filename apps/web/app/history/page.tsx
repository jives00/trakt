"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { HistoryItem } from "@trakt/types";

export const dynamic = "force-dynamic";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

function formatWatchedAt(iso: string): string {
  const date = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
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
    const d = new Date(item.watchedAt.endsWith('Z') ? item.watchedAt : item.watchedAt + 'Z');
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

type FilterType = "all" | "movie" | "episode";

export default function HistoryPage() {
  const { token, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date") ?? undefined;
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (t: string, f: FilterType, p: number, date: string | undefined, reset = false) => {
    setFetching(true);
    try {
      const data = await api.getHistory(t, f, p, 20, date);
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
    load(token, filter, 1, dateParam, true);
    setPage(1);
  }, [token, isLoading, filter, dateParam, load]);

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
    await load(token, filter, next, dateParam);
  }

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;

  const groups = groupByDay(items);
  const hasMore = items.length < total;

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <header className="mb-8">
        <h1 className="text-h1 font-black tracking-tight text-on-surface mb-1">History</h1>
      </header>

      <div className="flex gap-2 mb-8">
        {(["all", "movie", "episode"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-full text-sm transition-colors ${
              filter === f
                ? "bg-accent text-white"
                : "bg-surface-container-low text-on-surface-variant/70 border border-outline-variant/40 hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            {f === "all" ? "All Media" : f === "movie" ? "Movies" : "Episodes"}
          </button>
        ))}
      </div>

      {fetching && items.length === 0 && (
        <p className="text-on-surface-variant/70">Loading...</p>
      )}

      {groups.map(([day, dayItems]) => (
        <section key={day} className="mb-10">
          <div className="flex items-center gap-4 mb-5">
            <h2 className="text-h2 font-black text-on-surface">{day}</h2>
            <div className="h-px flex-grow bg-on-surface/5" />
            <span className="text-sm font-bold uppercase tracking-widest text-accent">
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
            className="px-6 py-3 rounded-lg bg-surface-container-low border border-outline-variant/40 text-on-surface-variant/70 hover:text-on-surface text-sm font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
          >
            {fetching ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {!fetching && items.length === 0 && (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block">history</span>
          <p className="text-on-surface-variant/70">No watch history yet.</p>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ item, onDelete }: { item: HistoryItem; onDelete: () => void }) {
  const isEpisode = item.mediaType === "episode";
  const posterUrl = item.posterPath ? `${TMDB_IMG}w185${item.posterPath}` : null;
  const href =
    isEpisode && item.tmdbId != null && item.seasonNumber != null && item.episodeNumber != null
      ? `/shows/${item.tmdbId}/seasons/${item.seasonNumber}/episodes/${item.episodeNumber}`
      : item.tmdbId != null
      ? `/movies/${item.tmdbId}`
      : null;

  const inner = (
    <div className="flex h-44">
      <div className="w-32 relative flex-shrink-0 bg-surface-container-low">
        {posterUrl ? (
          <Image src={posterUrl} alt={item.title ?? ""} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">
              {isEpisode ? "tv" : "movie"}
            </span>
          </div>
        )}
      </div>
      <div className="flex-grow p-5 flex flex-col justify-start gap-1">
        <h3 className="font-bold text-xl leading-tight text-on-surface line-clamp-1">
          {isEpisode ? item.showTitle : item.title}
        </h3>
        {isEpisode && item.seasonNumber != null && item.episodeNumber != null && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-accent font-bold">
              S{String(item.seasonNumber).padStart(2, "0")} &middot; E{String(item.episodeNumber).padStart(2, "0")}
            </span>
            {item.title && (
              <span className="text-sm text-on-surface/60 truncate">{item.title}</span>
            )}
          </div>
        )}
        {!isEpisode && (
          <span className="text-sm text-on-surface-variant/70 font-bold uppercase">Movie</span>
        )}
        <div className="flex items-center gap-3 border-t border-outline-variant/30 pt-3 mt-auto">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            className="text-on-surface-variant/40 hover:text-accent transition-colors material-symbols-outlined text-lg"
            aria-label="Delete history entry"
          >
            delete
          </button>
          <span className="text-sm text-on-surface-variant/70">{formatWatchedAt(item.watchedAt)}</span>
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="glass-panel overflow-hidden group red-glow-hover transition-all duration-300 block">
      {inner}
    </Link>
  ) : (
    <div className="glass-panel overflow-hidden group red-glow-hover transition-all duration-300">
      {inner}
    </div>
  );
}
