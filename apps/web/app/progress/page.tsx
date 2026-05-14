"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ProgressItem } from "@trakt/types";

export const dynamic = "force-dynamic";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

type SortOption = "alphabetical" | "percent-watched" | "episodes-watched";

export default function ProgressPage() {
  const { token, isLoading } = useAuth();
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("alphabetical");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    setFetching(true);
    api.getProgress(token, "all")
      .then(setItems)
      .catch(() => setError("Failed to load progress."))
      .finally(() => setFetching(false));
  }, [token, isLoading]);

  const sorted = [...items].sort((a, b) => {
    switch (sortBy) {
      case "alphabetical":
        return a.title.localeCompare(b.title);
      case "percent-watched": {
        const aPct = a.totalEpisodes > 0 ? (a.watchedEpisodes / a.totalEpisodes) * 100 : 0;
        const bPct = b.totalEpisodes > 0 ? (b.watchedEpisodes / b.totalEpisodes) * 100 : 0;
        return bPct - aPct;
      }
      case "episodes-watched":
        return b.watchedEpisodes - a.watchedEpisodes;
    }
  });

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-black tracking-tight text-on-surface mb-1">Watching Progress</h1>
          <p className="text-on-surface/40">
            {items.length > 0 ? `${items.length} show${items.length === 1 ? "" : "s"} in progress` : "No shows in progress."}
          </p>
        </div>
        <div className="flex gap-2">
          {(["alphabetical", "percent-watched", "episodes-watched"] as SortOption[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                sortBy === s ? "bg-accent text-on-surface" : "bg-surface-container text-on-surface/40 border border-outline-variant/40 hover:text-on-surface"
              }`}
            >
              {s === "alphabetical" ? "A–Z" : s === "percent-watched" ? "% Watched" : "Episodes"}
            </button>
          ))}
        </div>
      </header>

      {fetching && <p className="text-on-surface/40">Loading…</p>}

      {!fetching && items.length === 0 && (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface/20 mb-4 block">trending_up</span>
          <p className="text-on-surface/40">No in-progress shows.</p>
        </div>
      )}

      {!fetching && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {sorted.map((item) => <ProgressCard key={item.showId} item={item} />)}
        </div>
      )}
    </div>
  );
}

function ProgressCard({ item }: { item: ProgressItem }) {
  const pct = item.totalEpisodes > 0 ? Math.round((item.watchedEpisodes / item.totalEpisodes) * 100) : 0;
  const posterUrl = item.posterPath ? `${TMDB_IMG}w300${item.posterPath}` : null;

  return (
    <Link href={`/shows/${item.tmdbId}`} className="glass-panel rounded-2xl overflow-hidden group hover:-translate-y-1 transition-all duration-300 block">
      <div className="relative h-48">
        {posterUrl ? (
          <Image src={posterUrl} alt={item.title} fill className="object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-on-surface/20">tv</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent" />
      </div>
      <div className="p-5">
        <h4 className="font-bold text-on-surface text-base leading-tight mb-1 line-clamp-1">{item.title}</h4>
        {item.nextEpisode && (
          <p className="text-on-surface/40 text-xs font-medium mb-4 line-clamp-1">
            Next: S{String(item.nextEpisode.seasonNumber).padStart(2,"0")}E{String(item.nextEpisode.episodeNumber).padStart(2,"0")}
            {item.nextEpisode.title ? ` · ${item.nextEpisode.title}` : ""}
          </p>
        )}
        <div className="flex justify-between items-center text-[10px] font-bold text-on-surface/60 uppercase tracking-widest mb-2">
          <span>{item.watchedEpisodes} / {item.totalEpisodes} eps</span>
          <span className="text-accent">{pct}%</span>
        </div>
        <div className="h-1 bg-on-surface/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${pct}%`, boxShadow: "0 0 8px rgb(var(--accent-rgb))" }}
          />
        </div>
      </div>
    </Link>
  );
}


