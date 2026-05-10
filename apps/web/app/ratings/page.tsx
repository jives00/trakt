"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { RatingItem } from "@trakt/types";

export const dynamic = "force-dynamic";

const TMDB_IMG = "https://image.tmdb.org/t/p/";
type FilterType = "all" | "movie" | "show" | "episode";
type SortType = "date" | "rating";

export default function RatingsPage() {
  const { token, isLoading } = useAuth();
  const [items, setItems] = useState<RatingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("date");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (t: string, f: FilterType, s: SortType, p: number, reset = false) => {
    setFetching(true);
    try {
      const data = await api.getRatings(t, f, s, p);
      setItems((prev) => reset ? data.items : [...prev, ...data.items]);
      setTotal(data.total);
    } catch {
      setError("Failed to load ratings.");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading || !token) return;
    load(token, filter, sort, 1, true);
    setPage(1);
  }, [token, isLoading, filter, sort, load]);

  async function handleDelete(item: RatingItem) {
    if (!token) return;
    await api.deleteRating(item.mediaType, item.mediaId, token);
    setItems((prev) => prev.filter((r) => r.id !== item.id));
    setTotal((t) => t - 1);
  }

  async function loadMore() {
    if (!token) return;
    const next = page + 1;
    setPage(next);
    await load(token, filter, sort, next);
  }

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8">
          <h1 className="text-h1 font-black tracking-tight text-white mb-1">Ratings</h1>
          <p className="text-white/40">{total} item{total !== 1 ? "s" : ""} rated.</p>
        </header>

        <div className="flex flex-wrap gap-2 mb-8">
          <div className="flex gap-1">
            {(["all", "movie", "show", "episode"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                  filter === f ? "bg-accent text-white" : "bg-[#181818] text-white/40 border border-white/10 hover:text-white"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-1">
            {(["date", "rating"] as SortType[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                  sort === s ? "bg-[#181818] text-white border border-white/30" : "bg-[#181818] text-white/40 border border-white/10 hover:text-white"
                }`}
              >
                {s === "date" ? "By Date" : "By Rating"}
              </button>
            ))}
          </div>
        </div>

        {fetching && items.length === 0 && <p className="text-white/40">Loadingâ€¦</p>}

        {!fetching && items.length === 0 && (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-5xl text-white/20 mb-4 block">star</span>
            <p className="text-white/40">No ratings yet.</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <RatingCard key={item.id} item={item} onDelete={() => handleDelete(item)} />
          ))}
        </div>

        {items.length < total && (
          <div className="flex justify-center mt-8">
            <button
              onClick={loadMore}
              disabled={fetching}
              className="px-6 py-3 rounded-lg bg-[#181818] border border-white/10 text-white/60 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              {fetching ? "Loadingâ€¦" : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RatingCard({ item, onDelete }: { item: RatingItem; onDelete: () => void }) {
  const isEpisode = item.mediaType === "episode";
  const href = item.mediaType === "movie"
    ? `/movies/${item.tmdbId}`
    : `/shows/${item.tmdbId}`;
  const posterUrl = item.posterPath ? `${TMDB_IMG}w342${item.posterPath}` : null;
  const displayTitle = isEpisode ? (item.showTitle ?? item.title) : item.title;

  return (
    <div className="group relative">
      <Link href={href ?? "#"}>
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#181818] mb-2">
          {posterUrl ? (
            <Image src={posterUrl} alt={displayTitle ?? ""} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="material-symbols-outlined text-3xl text-white/20">
                {isEpisode ? "tv" : item.mediaType === "movie" ? "movie" : "tv"}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded-full">
            <span className="material-symbols-outlined text-xs text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            <span className="text-xs font-bold text-white">{item.rating}/10</span>
          </div>
        </div>
        <p className="text-sm font-semibold text-white line-clamp-1 group-hover:text-accent transition-colors">{displayTitle}</p>
        {item.year && <p className="text-xs text-white/40">{item.year}</p>}
        {isEpisode && item.seasonNumber != null && item.episodeNumber != null && (
          <p className="text-xs text-accent font-bold">
            S{String(item.seasonNumber).padStart(2, "0")}E{String(item.episodeNumber).padStart(2, "0")}
          </p>
        )}
      </Link>
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white/40 hover:text-accent transition-colors opacity-0 group-hover:opacity-100 material-symbols-outlined text-base"
        aria-label="Delete rating"
      >
        close
      </button>
    </div>
  );
}

