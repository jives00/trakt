"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { UpNextItem } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

export function UpNextSection({ items: initialItems }: { items: UpNextItem[] }) {
  const { token } = useAuth();
  const [items, setItems] = useState(initialItems);

  if (items.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeading>Up Next</SectionHeading>
        <p className="text-on-surface-variant text-body-md">
          No shows tracked yet.{" "}
          <Link href="/search" className="text-primary-container hover:underline">Search for a show</Link>{" "}
          to get started.
        </p>
      </section>
    );
  }

  const handleEpisodeWatched = async (episodeId: number) => {
    setItems((prev) => prev.filter((item) => item.episodeId !== episodeId));

    if (token) {
      try {
        const updated = await api.getUpNext(token);
        setItems(updated);
      } catch (error) {
        console.error("Failed to refresh up-next list:", error);
      }
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionHeading>Up Next</SectionHeading>
        <div className="flex gap-2">
          <button className="w-8 h-8 rounded-full glass-panel flex items-center justify-center hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button className="w-8 h-8 rounded-full glass-panel flex items-center justify-center hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>
      <div className="flex gap-gutter overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => <UpNextCard key={item.episodeId} item={item} onWatched={handleEpisodeWatched} />)}
      </div>
    </section>
  );
}

function UpNextCard({ item, onWatched }: { item: UpNextItem; onWatched: (episodeId: number) => Promise<void> }) {
  const { token } = useAuth();
  const [isMarking, setIsMarking] = useState(false);
  const href = `/shows/${item.showTmdbId}`;

  const handleMarkAsWatched = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!token || isMarking) return;

    setIsMarking(true);
    try {
      await api.toggleEpisodeWatched(item.showTmdbId, item.seasonNumber, item.episodeNumber, false, token);
      await onWatched(item.episodeId);
    } catch (error) {
      console.error("Failed to mark as watched:", error);
      setIsMarking(false);
    }
  };

  return (
    <Link href={href} className="group flex-none w-56">
      <div className="relative aspect-[2/3] overflow-hidden bg-surface-container-high border border-white/5 transition-transform duration-300 group-hover:scale-[1.02]">
        {item.posterPath ? (
          <Image src={`${TMDB_IMG}${item.posterPath}`} alt={item.showTitle} fill sizes="224px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-variant text-label-sm uppercase tracking-widest p-2 text-center">
            {item.showTitle}
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={handleMarkAsWatched}
            disabled={isMarking}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#e8002d] hover:bg-[#cc0028] disabled:opacity-50 text-white font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Mark as Watched
          </button>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
          {item.totalAired > 0 && (
            <div
              className="h-full bg-[#e8002d] transition-all duration-300"
              style={{ width: `${(item.watchedCount / item.totalAired) * 100}%` }}
            />
          )}
        </div>
      </div>
      <div className="mt-2 px-0.5 flex justify-between items-start">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-on-surface">{item.showTitle}</p>
          <p className="text-sm text-on-surface-variant">
            S{item.seasonNumber}E{item.episodeNumber}
            {item.episodeTitle ? ` · ${item.episodeTitle}` : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-h2 font-black tracking-tight text-on-surface">
      <span className="block h-8 w-1 rounded-full bg-primary-container" />
      {children}
    </h2>
  );
}
