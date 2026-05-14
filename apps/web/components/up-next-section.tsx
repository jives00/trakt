"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { WatchDatePicker } from "./watch-date-picker";
import type { UpNextItem } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

export function UpNextSection({ items: initialItems }: { items: UpNextItem[] }) {
  const { token } = useAuth();
  const [items, setItems] = useState(initialItems);
  const [removingEpisodeId, setRemovingEpisodeId] = useState<number | null>(null);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    checkScroll();
    const container = scrollContainerRef.current;
    container?.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    return () => {
      container?.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [items]);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

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

  const onRemovalStart = (episodeId: number) => {
    const index = items.findIndex(it => it.episodeId === episodeId);
    setRemovingEpisodeId(episodeId);
    setRemovingIndex(index);
  };

  const handleEpisodeWatched = async (episodeId: number) => {
    if (token) {
      const removingIdx = items.findIndex(it => it.episodeId === episodeId);
      const removingShow = items[removingIdx];

      try {
        const updated = await api.getUpNext(token);
        const newItemForShow = updated.find(it => it.showTmdbId === removingShow?.showTmdbId);

        // Wait for fade-out animation to complete
        setTimeout(() => {
          if (newItemForShow) {
            // New episode exists - reorder to put it at the same position for fade-in
            const reordered = updated.filter(it => it.episodeId !== newItemForShow.episodeId);
            reordered.splice(removingIdx, 0, newItemForShow);
            setItems(reordered);
            // Keep removingIndex/removingEpisodeId set so new card at this position gets fadeIn=true
          } else {
            // No new episode - just use updated list and clear removal state
            setItems(updated);
            setRemovingEpisodeId(null);
            setRemovingIndex(null);
          }
        }, 700);

        // Only clear removal state AFTER fade-in animation completes (another 700ms)
        if (newItemForShow) {
          setTimeout(() => {
            setRemovingEpisodeId(null);
            setRemovingIndex(null);
          }, 1400);
        }
      } catch (error) {
        setRemovingEpisodeId(null);
        setRemovingIndex(null);
      }
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionHeading>Up Next</SectionHeading>
        {(canScrollLeft || canScrollRight) && (
          <div className="flex gap-2">
            <button
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className="w-8 h-8 rounded-full glass-panel flex items-center justify-center hover:bg-on-surface/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              className="w-8 h-8 rounded-full glass-panel flex items-center justify-center hover:bg-on-surface/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        )}
      </div>
      <div ref={scrollContainerRef} className="flex gap-gutter overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden transition-all duration-700" style={{ scrollBehavior: "smooth" }}>
        {items.map((item, index) => {
          const shouldFadeIn = removingIndex !== null && removingIndex >= 0 && index === removingIndex && item.episodeId !== removingEpisodeId;
          return (
            <UpNextCard
              key={item.episodeId}
              item={item}
              onRemovalStart={onRemovalStart}
              onWatched={handleEpisodeWatched}
              fadeIn={shouldFadeIn}
            />
          );
        })}
      </div>
    </section>
  );
}

function UpNextCard({ item, onRemovalStart, onWatched, fadeIn }: { item: UpNextItem; onRemovalStart: (episodeId: number) => void; onWatched: (episodeId: number) => Promise<void>; fadeIn?: boolean }) {
  const { token } = useAuth();
  const [isMarking, setIsMarking] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showContent, setShowContent] = useState(!fadeIn);

  useEffect(() => {
    if (fadeIn) {
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [fadeIn]);
  const episodeHref = `/shows/${item.showTmdbId}/seasons/${item.seasonNumber}/episodes/${item.episodeNumber}`;
  const showHref = `/shows/${item.showTmdbId}`;

  const handleMarkAsWatched = async (watchedAt: string) => {
    if (!token || isMarking) return;

    onRemovalStart(item.episodeId);
    setIsMarking(true);
    setIsRemoving(true);
    try {
      await api.toggleEpisodeWatched(item.showTmdbId, item.seasonNumber, item.episodeNumber, false, token, watchedAt);
      await onWatched(item.episodeId);
    } catch (error) {
      setIsMarking(false);
      setIsRemoving(false);
    }
  };

  const handleDismiss = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!token || isRemoving) return;

    onRemovalStart(item.episodeId);
    setIsRemoving(true);
    try {
      await api.toggleShowWatchlist(item.showTmdbId, true, token);
      await onWatched(item.episodeId);
    } catch (error) {
      console.error("Failed to dismiss show:", error);
      setIsRemoving(false);
    }
  };

  return (
    <div
      className={`flex-none w-56 transition-all duration-700`}
      style={{
        opacity: fadeIn && !showContent ? 0 : isRemoving ? 0 : 1,
        transform: isRemoving ? "scale(0.95)" : "scale(1)"
      }}
    >
      <Link href={episodeHref} className="group relative aspect-[2/3] overflow-hidden bg-surface-container-high border border-outline-variant/30 transition-transform duration-300 group-hover:scale-[1.02] block">
        {item.posterPath ? (
          <Image src={`${TMDB_IMG}${item.posterPath}`} alt={item.showTitle} fill sizes="224px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-variant text-label-sm uppercase tracking-widest p-2 text-center">
            {item.showTitle}
          </div>
        )}
        <div
          className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-3 pointer-events-none group-hover:pointer-events-auto"
        >
          <div className="w-full">
            <WatchDatePicker
              watched={false}
              releaseDate={item.airDate ?? null}
              onMark={handleMarkAsWatched}
              releaseDateLabel="Air Date"
            />
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDismiss(e as any);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            disabled={isRemoving}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white font-semibold transition-colors w-full justify-center"
          >
            <span className="material-symbols-outlined text-base">close</span>
            Remove
          </button>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-on-surface/20">
          {item.totalAired > 0 && (
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${(item.watchedCount / item.totalAired) * 100}%` }}
            />
          )}
        </div>
      </Link>
      <div className="mt-2 px-0.5 flex justify-between items-start">
        <div className="min-w-0">
          <Link href={showHref} className="truncate text-base font-semibold text-on-surface hover:text-primary-container transition-colors block">
            {item.showTitle}
          </Link>
          <Link href={episodeHref} className="text-sm text-on-surface-variant hover:text-primary-container transition-colors block">
            S{item.seasonNumber}E{item.episodeNumber}
            {item.episodeTitle ? ` · ${item.episodeTitle}` : ""}
          </Link>
        </div>
      </div>
    </div>
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

