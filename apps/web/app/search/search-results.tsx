"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { SearchResult } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

const FILTER_LABELS = ["All", "Trending", "Popular", "Recommended", "New Premiers"] as const;
type SortOption = "Relevance" | "Rating" | "Year";

export function SearchResults() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [sort, setSort] = useState<SortOption>("Relevance");
  const [showSort, setShowSort] = useState(false);
  const lastSearchedRef = useRef<string | null>(null);

  useEffect(() => {
    const initialQuery = params.get("q");
    if (initialQuery && initialQuery !== lastSearchedRef.current) {
      lastSearchedRef.current = initialQuery;
      setQuery(initialQuery);
      runSearch(initialQuery);
    }
  }, [params, token]);

  async function runSearch(q: string) {
    if (!q.trim() || !token) return;
    lastSearchedRef.current = q.trim();
    router.replace(`/search?q=${encodeURIComponent(q.trim())}`);
    setLoading(true);
    try {
      const data = await api.search(q.trim(), token);
      setResults(data);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  const featured = results?.[0] ?? null;

  return (
    <div className="flex flex-col gap-stack-md">
      {/* Hero Featured Section */}
      {featured && !loading && (
        <section className="-mx-margin-page relative h-[360px] overflow-hidden mb-4 border-b border-white/10 group">
          {featured.posterPath && (
            <Image
              src={`https://image.tmdb.org/t/p/w1280${featured.posterPath}`}
              alt={featured.title}
              fill
              className="object-cover object-top"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full md:w-2/3">
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-[#e8002d] text-white text-[10px] font-black px-2 py-1 rounded tracking-tighter uppercase">Top Result</span>
              {featured.mediaType && (
                <span className="text-white/60 text-sm font-bold uppercase tracking-widest">
                  {featured.mediaType === "movie" ? "Movie" : "Show"}
                </span>
              )}
            </div>
            <h1 className="text-h1 font-black text-white mb-3 leading-none">{featured.title}</h1>
            {featured.overview && (
              <p className="text-white/70 mb-6 max-w-xl line-clamp-2 text-sm">{featured.overview}</p>
            )}
            <div className="flex flex-wrap gap-4">
              <Link
                href={featured.mediaType === "movie" ? `/movies/${featured.tmdbId}` : `/shows/${featured.tmdbId}`}
                className="bg-[#e8002d] hover:bg-[#ff1a4a] text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                View Details
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Search Form */}
      <form onSubmit={handleSubmit}>
        <input
          role="searchbox"
          aria-label="Search movies and shows"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies and shows…"
          className="w-full rounded-full border border-outline-variant bg-surface-container px-5 py-3 text-on-surface placeholder:text-on-surface-variant focus:border-primary-container focus:outline-none"
        />
      </form>

      {/* Filters + Sort Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden w-full md:w-auto">
          {FILTER_LABELS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                activeFilter === f
                  ? "bg-[#e8002d] text-white"
                  : "bg-[#181818] border border-white/10 text-white/60 hover:text-white hover:border-white/30"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex items-center gap-3">
          <span className="text-white/40 text-sm font-bold uppercase tracking-widest whitespace-nowrap">Sort by:</span>
          <button
            onClick={() => setShowSort((s) => !s)}
            className="flex items-center gap-2 text-white font-bold text-sm"
          >
            {sort}
            <span className="material-symbols-outlined text-[#e8002d]">expand_more</span>
          </button>
          {showSort && (
            <div className="absolute top-full right-0 mt-1 bg-[#181818] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
              {(["Relevance", "Rating", "Year"] as SortOption[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { setSort(s); setShowSort(false); }}
                  className={`block w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-white/5 ${sort === s ? "text-[#e8002d]" : "text-white/60"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && <p className="text-center text-on-surface-variant py-8">Searching…</p>}

      {!loading && searched && results?.length === 0 && (
        <p className="text-center text-on-surface-variant py-8">No results found.</p>
      )}

      {!loading && !searched && (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-5xl text-white/20 mb-4 block">search</span>
          <p className="text-white/40">Search for movies and shows above.</p>
        </div>
      )}

      {!loading && results && results.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-gutter">
            {results.map((item) => <MediaCard key={`${item.mediaType}-${item.tmdbId}`} item={item} token={token} />)}
          </div>

          {/* Load More */}
          <div className="flex justify-center pt-4">
            <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#181818] border border-white/10 text-white/60 hover:text-white font-bold text-sm uppercase tracking-widest transition-colors">
              Load More Results
              <span className="material-symbols-outlined text-sm animate-bounce">keyboard_double_arrow_down</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MediaCard({ item, token }: { item: SearchResult; token: string | null }) {
  const href = item.mediaType === "movie" ? `/movies/${item.tmdbId}` : `/shows/${item.tmdbId}`;

  async function handleWatchlist(e: React.MouseEvent) {
    e.preventDefault();
    if (!token) return;
    if (item.mediaType === "movie") {
      await api.toggleMovieWatchlist(item.tmdbId, false, token).catch(() => {});
    } else {
      await api.toggleShowWatchlist(item.tmdbId, false, token).catch(() => {});
    }
  }

  async function handleCollect(e: React.MouseEvent) {
    e.preventDefault();
    if (!token) return;
    if (item.mediaType === "movie") {
      await api.toggleMovieCollection(item.tmdbId, false, token).catch(() => {});
    } else {
      await api.toggleShowCollection(item.tmdbId, false, token).catch(() => {});
    }
  }

  return (
    <div className="flex flex-col gap-3 group">
      <Link href={href} className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/5 bg-[#181818] block transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-[#e8002d]/20">
        {item.posterPath ? (
          <Image
            src={`${TMDB_IMG}${item.posterPath}`}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-variant text-label-sm uppercase tracking-widest">
            No Image
          </div>
        )}
        {/* Rating badge */}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-black text-[#e8002d]">
          {item.year ?? "—"}
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-3 px-4">
          <button
            onClick={handleWatchlist}
            className="w-full bg-[#e8002d] text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">bookmark</span> Watchlist
          </button>
          <button
            onClick={handleCollect}
            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">library_add</span> Collect
          </button>
        </div>
      </Link>
      <div>
        <h3 className="text-white font-bold text-sm truncate">{item.title}</h3>
        <p className="text-white/40 text-[10px] uppercase tracking-widest mt-1">
          {item.mediaType === "movie" ? "Movie" : "Show"}{item.year ? ` · ${item.year}` : ""}
        </p>
      </div>
    </div>
  );
}
