"use client";

import Link from "next/link";
import Image from "next/image";
import type { EpisodeItem } from "@/lib/api";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

function formatDate(date: string | null): string | null {
  if (!date) return null;
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface EpisodeRowProps {
  tmdbId: number;
  seasonNumber: number;
  ep: EpisodeItem;
  watched: boolean;
  onToggle: () => void;
}

export function EpisodeRow({ tmdbId, seasonNumber, ep, watched, onToggle }: EpisodeRowProps) {
  const stillUrl = ep.stillPath ? `${TMDB_IMG}w500${ep.stillPath}` : null;
  const href = `/shows/${tmdbId}/seasons/${seasonNumber}/episodes/${ep.episodeNumber}`;
  return (
    <div className="flex gap-5 py-5 border-b border-white/5 last:border-0">
      <Link href={href} className="shrink-0 relative w-56 aspect-video bg-surface-container-high overflow-hidden rounded">
        {stillUrl ? (
          <Image src={stillUrl} alt={ep.title ?? ""} fill className="object-cover hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-white/20">tv</span>
          </div>
        )}
        {ep.runtimeMin && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-2 py-0.5 rounded text-xs font-bold text-white">{ep.runtimeMin}m</div>
        )}
      </Link>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-white/50 text-sm font-bold uppercase tracking-widest mb-1.5">
          S{String(seasonNumber).padStart(2, "0")} · E{String(ep.episodeNumber).padStart(2, "0")}
        </p>
        <Link href={href} className="hover:text-[#e8002d] transition-colors">
          <p className="text-white font-bold leading-snug mb-2 line-clamp-1 text-lg">{ep.title ?? `Episode ${ep.episodeNumber}`}</p>
        </Link>
        {ep.overview && (
          <p className="text-white/50 text-sm line-clamp-3 mb-3">{ep.overview}</p>
        )}
        <div className="flex items-center gap-2 text-white/40 text-sm">
          {ep.airDate && <span>{formatDate(ep.airDate)}</span>}
          {ep.airDate && ep.runtimeMin && <span>·</span>}
          {ep.runtimeMin && <span>{ep.runtimeMin} min</span>}
        </div>
      </div>
      <div className="shrink-0 flex items-start pt-1">
        <button
          onClick={onToggle}
          aria-label={watched ? "Mark unwatched" : "Mark watched"}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
            watched
              ? "bg-[#e8002d] border-[#e8002d] text-white"
              : "border-white/20 text-white/40 hover:border-[#e8002d]/40 hover:text-[#e8002d]"
          }`}
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: watched ? "'FILL' 1" : "'FILL' 0" }}>
            check_circle
          </span>
          {watched ? "Watched" : "Watch"}
        </button>
      </div>
    </div>
  );
}
