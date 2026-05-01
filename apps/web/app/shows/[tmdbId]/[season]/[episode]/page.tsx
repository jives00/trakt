"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api, type EpisodeItem } from "@/lib/api";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

export default function EpisodePage() {
  const { tmdbId, season: seasonStr, episode: epStr } = useParams<{ tmdbId: string; season: string; episode: string }>();
  const season = Number(seasonStr);
  const epNum = Number(epStr);
  const { token, isLoading } = useAuth();
  const [ep, setEp] = useState<EpisodeItem | null>(null);
  const [watched, setWatched] = useState(false);
  const [showTitle, setShowTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    const tid = Number(tmdbId);
    Promise.all([api.getSeason(tid, season, token), api.getShow(tid, token)])
      .then(([seasonData, showData]) => {
        const found = seasonData.episodes.find((e) => e.episodeNumber === epNum);
        if (found) {
          setEp(found);
          setWatched(seasonData.watchedEpisodeIds.includes(found.id));
        }
        setShowTitle(showData.show.title);
      })
      .catch(() => setError("Failed to load episode."));
  }, [isLoading, token, tmdbId, season, epNum]);

  async function toggleWatched() {
    if (!token || !ep) return;
    const res = await api.toggleEpisodeWatched(Number(tmdbId), season, ep.episodeNumber, watched, token);
    setWatched(res.watched);
  }

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;
  if (!ep) return <p className="text-white/40">Loading…</p>;

  const stillUrl = ep.stillPath ? `${TMDB_IMG}w780${ep.stillPath}` : null;

  return (
    <div>
      <header className="mb-6">
        <Link href={`/shows/${tmdbId}/${season}`} className="flex items-center gap-1 text-xs text-white/40 hover:text-white mb-3 transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {showTitle} — Season {season}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[#e8002d] text-label-sm font-bold uppercase tracking-widest mb-1">
              S{String(season).padStart(2, "0")} · E{String(ep.episodeNumber).padStart(2, "0")}
            </p>
            <h1 className="text-h1 font-black tracking-tight text-white">
              {ep.title ?? `Episode ${ep.episodeNumber}`}
            </h1>
          </div>
          <button
            onClick={toggleWatched}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
              watched
                ? "bg-[#e8002d] text-white"
                : "bg-[#181818] border border-white/10 text-white/60 hover:text-white hover:border-[#e8002d]/40"
            }`}
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: watched ? "'FILL' 1" : "'FILL' 0" }}>
              check_circle
            </span>
            {watched ? "Watched" : "Mark Watched"}
          </button>
        </div>
      </header>

      {stillUrl && (
        <div className="relative -mx-margin-page h-72 overflow-hidden mb-8">
          <Image src={stillUrl} alt={ep.title ?? ""} fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-white/40 uppercase tracking-widest font-bold mb-6">
        {ep.airDate && <span>{new Date(ep.airDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>}
        {ep.runtimeMin && (
          <>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>{ep.runtimeMin} min</span>
          </>
        )}
      </div>

      {/* Episode nav */}
      <div className="flex gap-3 mt-8">
        {epNum > 1 && (
          <Link
            href={`/shows/${tmdbId}/${season}/${epNum - 1}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#181818] border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
            Previous
          </Link>
        )}
        <Link
          href={`/shows/${tmdbId}/${season}/${epNum + 1}`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#181818] border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors ml-auto"
        >
          Next
          <span className="material-symbols-outlined text-base">chevron_right</span>
        </Link>
      </div>
    </div>
  );
}
