"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { SearchResult } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

export function SearchResults() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function runSearch(q: string) {
    if (!q.trim() || !token) return;
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

  return (
    <div className="flex flex-col gap-stack-md">
      <form onSubmit={handleSubmit}>
        <input
          role="searchbox"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies and shows…"
          className="w-full rounded-full border border-outline-variant bg-surface-container px-5 py-3 text-on-surface placeholder:text-on-surface-variant focus:border-primary-container focus:outline-none"
        />
      </form>

      {loading && (
        <p className="text-center text-on-surface-variant">Searching…</p>
      )}

      {!loading && searched && results?.length === 0 && (
        <p className="text-center text-on-surface-variant">No results found.</p>
      )}

      {!loading && results && results.length > 0 && (
        <ul className="grid grid-cols-2 gap-stack-md sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {results.map((item) => (
            <li key={`${item.mediaType}-${item.tmdbId}`}>
              <MediaCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaCard({ item }: { item: SearchResult }) {
  const href = item.mediaType === "movie" ? `/movies/${item.tmdbId}` : `/shows/${item.tmdbId}`;

  return (
    <Link href={href} className="group block">
      <div className="relative overflow-hidden rounded-lg bg-surface-container-high aspect-[2/3]">
        {item.posterPath ? (
          <Image
            src={`${TMDB_IMG}${item.posterPath}`}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-variant text-label-sm uppercase tracking-widest">
            No Image
          </div>
        )}
      </div>
      <div className="mt-stack-xs px-1">
        <p className="truncate text-sm font-semibold text-on-surface">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {item.year && <span className="text-xs text-on-surface-variant">{item.year}</span>}
          <span className="text-label-sm uppercase tracking-widest text-primary-container">
            {item.mediaType === "movie" ? "Movie" : "Show"}
          </span>
        </div>
      </div>
    </Link>
  );
}
