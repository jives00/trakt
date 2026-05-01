"use client";

import Link from "next/link";
import Image from "next/image";
import type { UpNextItem } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

export function UpNextSection({ items }: { items: UpNextItem[] }) {
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
        {items.map((item) => <UpNextCard key={item.episodeId} item={item} />)}
      </div>
    </section>
  );
}

function UpNextCard({ item }: { item: UpNextItem }) {
  const href = `/shows/${item.showTmdbId}`;
  return (
    <Link href={href} className="group flex-none w-64">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-container-high border border-white/5 transition-transform duration-300 group-hover:scale-[1.02]">
        {item.posterPath ? (
          <Image src={`${TMDB_IMG}${item.posterPath}`} alt={item.showTitle} fill sizes="256px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-variant text-label-sm uppercase tracking-widest p-2 text-center">
            {item.showTitle}
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#e8002d] flex items-center justify-center text-white">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
            <span className="material-symbols-outlined">add</span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20" />
      </div>
      <div className="mt-2 px-0.5 flex justify-between items-start">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-on-surface">{item.showTitle}</p>
          <p className="text-xs text-on-surface-variant">
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
