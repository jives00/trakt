"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { CollectionItem } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/";
type FilterType = "all" | "movie" | "show";

export default function CollectionPage() {
  const { token, isLoading } = useAuth();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    setFetching(true);
    api.getCollection(token, filter)
      .then(setItems)
      .catch(() => setError("Failed to load collection."))
      .finally(() => setFetching(false));
  }, [token, isLoading, filter]);

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8">
          <h1 className="text-h1 font-black tracking-tight text-white mb-1">Collection</h1>
          <p className="text-white/40">{items.length} item{items.length !== 1 ? "s" : ""} collected.</p>
        </header>

        <div className="flex gap-2 mb-8">
          {(["all", "movie", "show"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                filter === f
                  ? "bg-[#e8002d] text-white"
                  : "bg-[#181818] text-white/40 border border-white/10 hover:text-white"
              }`}
            >
              {f === "all" ? "All" : f === "movie" ? "Movies" : "Shows"}
            </button>
          ))}
        </div>

        {fetching && <p className="text-white/40">Loading…</p>}

        {!fetching && items.length === 0 && (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-5xl text-white/20 mb-4 block">video_library</span>
            <p className="text-white/40">Your collection is empty.</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <CollectionCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CollectionCard({ item }: { item: CollectionItem }) {
  const href = item.mediaType === "movie" ? `/movies/${item.tmdbId}` : `/shows/${item.tmdbId}`;
  const posterUrl = item.posterPath ? `${TMDB_IMG}w342${item.posterPath}` : null;

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#181818] mb-2 red-glow-hover transition-all duration-300">
        {posterUrl ? (
          <Image src={posterUrl} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="material-symbols-outlined text-3xl text-white/20">
              {item.mediaType === "movie" ? "movie" : "tv"}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-2 right-2">
          <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-black/60 text-white/60">
            {item.mediaType === "movie" ? "Movie" : "Show"}
          </span>
        </div>
      </div>
      <p className="text-sm font-semibold text-white line-clamp-1 group-hover:text-[#e8002d] transition-colors">{item.title}</p>
      {item.year && <p className="text-xs text-white/40">{item.year}</p>}
    </Link>
  );
}
