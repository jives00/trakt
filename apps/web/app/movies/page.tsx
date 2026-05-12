"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { DiscoverItem, DiscoverPeriod, MovieDiscoverCategory } from "@trakt/types";

export const dynamic = "force-dynamic";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

const categories: { id: MovieDiscoverCategory; label: string; description: string }[] = [
  { id: "trending", label: "Trending", description: "Movies getting attention this week" },
  { id: "popular", label: "Popular", description: "Broad audience favorites" },
  { id: "now_playing", label: "Now Playing", description: "Currently in theaters" },
  { id: "upcoming", label: "Upcoming", description: "Theatrical releases on the way" },
  { id: "top_rated", label: "Top Rated", description: "Highest rated TMDB movies" },
];

const periods: { id: DiscoverPeriod; label: string }[] = [
  { id: "all_time", label: "All Time" },
  { id: "past_year", label: "Past Year" },
  { id: "past_6_months", label: "6 Months" },
  { id: "past_3_months", label: "3 Months" },
  { id: "past_month", label: "Past Month" },
];

export default function MoviesPage() {
  const { token, isLoading } = useAuth();
  const [category, setCategory] = useState<MovieDiscoverCategory>("trending");
  const [period, setPeriod] = useState<DiscoverPeriod>("all_time");
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const activeCategory = useMemo(
    () => categories.find((item) => item.id === category) ?? categories[0],
    [category],
  );

  useEffect(() => {
    if (isLoading || !token) return;

    setFetching(true);
    setFetchError("");

    api.getMovieDiscover(category, token, page, "US", period)
      .then((response) => {
        setItems(response.items);
        setTotalPages(response.totalPages);
      })
      .catch(() => {
        setItems([]);
        setFetchError("Failed to load movies.");
      })
      .finally(() => setFetching(false));
  }, [category, page, period, token, isLoading]);

  function changeCategory(next: MovieDiscoverCategory) {
    setCategory(next);
    setPage(1);
  }

  if (isLoading) return null;

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div className="flex flex-col gap-8">
        <header>
          <p className="text-[10px] uppercase tracking-widest font-black text-accent mb-2">Discover</p>
          <h1 className="text-h1 font-black tracking-tight text-white">Movies</h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-start">
          <aside className="lg:sticky lg:top-24">
            <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
              {categories.map((item) => {
                const active = item.id === category;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeCategory(item.id)}
                    className={
                      active
                        ? "flex-none lg:flex-auto text-left px-4 py-3 rounded-lg bg-accent/15 text-white border border-accent/30"
                        : "flex-none lg:flex-auto text-left px-4 py-3 rounded-lg text-white/45 border border-white/5 hover:text-white hover:bg-white/5 transition-colors"
                    }
                  >
                    <span className="block text-xs font-black uppercase tracking-widest">{item.label}</span>
                    <span className="mt-1 block text-xs leading-snug text-white/35">{item.description}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0">
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <h2 className="text-h2 font-black tracking-tight text-white">{activeCategory.label}</h2>
                <p className="text-sm text-white/40 mt-1">{activeCategory.description}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-white/40 tabular-nums">
                <button
                  type="button"
                  disabled={page <= 1 || fetching}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="h-9 w-9 rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Previous page"
                >
                  <span className="material-symbols-outlined text-lg leading-none">chevron_left</span>
                </button>
                <span>Page {page}</span>
                <button
                  type="button"
                  disabled={page >= totalPages || fetching}
                  onClick={() => setPage((value) => value + 1)}
                  className="h-9 w-9 rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Next page"
                >
                  <span className="material-symbols-outlined text-lg leading-none">chevron_right</span>
                </button>
              </div>
            </div>

            {category === "top_rated" && (
              <div className="mb-5 flex flex-wrap gap-2">
                {periods.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPeriod(item.id);
                      setPage(1);
                    }}
                    className={
                      period === item.id
                        ? "px-3 py-2 rounded-full bg-white text-black text-xs font-black uppercase tracking-wide"
                        : "px-3 py-2 rounded-full bg-white/5 text-white/45 text-xs font-black uppercase tracking-wide hover:bg-white/10 hover:text-white transition-colors"
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {fetchError ? (
              <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{fetchError}</div>
            ) : fetching ? (
              <MovieGridSkeleton />
            ) : (
              <MovieGrid items={items} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function MovieGrid({ items }: { items: DiscoverItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center text-white/45">
        No movies found for this category.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-5">
      {items.map((item) => (
        <MovieCard key={item.tmdbId} item={item} />
      ))}
    </div>
  );
}

function MovieCard({ item }: { item: DiscoverItem }) {
  const posterUrl = item.posterPath ? `${TMDB_IMG}w342${item.posterPath}` : null;
  return (
    <Link href={`/movies/${item.tmdbId}`} className="group min-w-0">
      <div className="relative aspect-[2/3] overflow-hidden bg-surface-container-high border border-white/5">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 20vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-white/20">movie</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent opacity-90" />
        {item.rating !== null && (
          <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
            {item.rating}%
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 text-sm font-black leading-tight text-white">{item.title}</h3>
          {item.year && <p className="mt-1 text-xs text-white/50">{item.year}</p>}
        </div>
      </div>
    </Link>
  );
}

function MovieGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-5">
      {Array.from({ length: 15 }).map((_, index) => (
        <div key={index} className="aspect-[2/3] bg-white/[0.06] animate-pulse" />
      ))}
    </div>
  );
}
