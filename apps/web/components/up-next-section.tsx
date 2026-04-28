"use client";

import Link from "next/link";
import Image from "next/image";
import type { UpNextItem } from "@/lib/api";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

export function UpNextSection({ items }: { items: UpNextItem[] }) {
  if (items.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeading>Up Next</SectionHeading>
        <p className="text-on-surface-variant text-body-md">
          No shows tracked yet.{" "}
          <Link href="/search" className="text-primary-container hover:underline">
            Search for a show
          </Link>{" "}
          to get started.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>Up Next</SectionHeading>
      <div className="flex gap-gutter overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <UpNextCard key={item.episodeId} item={item} />
        ))}
      </div>
    </section>
  );
}

function UpNextCard({ item }: { item: UpNextItem }) {
  const href = `/shows/${item.showTmdbId}`;
  return (
    <Link href={href} className="group flex-none w-48">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-container-high border border-outline-variant transition-transform duration-300 group-hover:scale-[1.03]">
        {item.posterPath ? (
          <Image
            src={`${TMDB_IMG}${item.posterPath}`}
            alt={item.showTitle}
            fill
            sizes="192px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-variant text-label-sm uppercase tracking-widest p-2 text-center">
            {item.showTitle}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-semibold text-on-surface">{item.showTitle}</p>
        <p className="text-xs text-on-surface-variant">
          S{item.seasonNumber}E{item.episodeNumber}
          {item.episodeTitle ? ` · ${item.episodeTitle}` : ""}
        </p>
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
