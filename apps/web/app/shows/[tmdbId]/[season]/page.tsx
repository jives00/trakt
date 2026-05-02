"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api, type EpisodeItem } from "@/lib/api";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

export default function SeasonPage() {
  const { tmdbId, season: seasonStr } = useParams<{ tmdbId: string; season: string }>();
  const season = Number(seasonStr);
  const { token, isLoading } = useAuth();
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [watchedIds, setWatchedIds] = useState<number[]>([]);
  const [showTitle, setShowTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    const tid = Number(tmdbId);
    Promise.all([
      api.getSeason(tid, season, token),
      api.getShow(tid, token),
    ])
      .then(([seasonData, showData]) => {
        setEpisodes(seasonData.episodes);
        setWatchedIds(seasonData.watchedEpisodeIds);
        setShowTitle(showData.show.title);
      })
      .catch(() => setError("Failed to load season."));
  }, [isLoading, token, tmdbId, season]);

  async function toggleEpisode(ep: EpisodeItem) {
    if (!token) return;
    const watched = watchedIds.includes(ep.id);
    const res = await api.toggleEpisodeWatched(Number(tmdbId), season, ep.episodeNumber, watched, token);
    setWatchedIds((prev) =>
      res.watched ? [...prev, ep.id] : prev.filter((id) => id !== ep.id)
    );
  }

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;

  const watchedCount = episodes.filter((e) => watchedIds.includes(e.id)).length;

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8">
          <Link href={`/shows/${tmdbId}`} className="flex items-center gap-1 text-xs text-white/40 hover:text-white mb-3 transition-colors">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {showTitle || "Show"}
          </Link>
          <h1 className="text-h1 font-black tracking-tight text-white mb-1">Season {season}</h1>
          <p className="text-white/40">
            {watchedCount} / {episodes.length} episodes watched
          </p>
          {episodes.length > 0 && (
            <div className="mt-3 h-1.5 w-48 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#e8002d] transition-all"
                style={{ width: `${(watchedCount / episodes.length) * 100}%` }}
              />
            </div>
          )}
        </header>

        {episodes.length === 0 && <p className="text-white/40">Loading…</p>}

        <div className="flex flex-col gap-3">
          {episodes.map((ep) => {
            const watched = watchedIds.includes(ep.id);
            const stillUrl = ep.stillPath ? `${TMDB_IMG}w300${ep.stillPath}` : null;
            return (
              <div
                key={ep.id}
                className={`glass-panel rounded-xl overflow-hidden red-glow-hover transition-all duration-300 ${watched ? "opacity-70" : ""}`}
              >
                <div className="flex h-28">
                  <Link href={`/shows/${tmdbId}/${season}/${ep.episodeNumber}`} className="relative w-40 flex-shrink-0 bg-[#181818]">
                    {stillUrl ? (
                      <Image src={stillUrl} alt={ep.title ?? ""} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <span className="material-symbols-outlined text-2xl text-white/20">videocam</span>
                      </div>
                    )}
                    {watched && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl text-[#e8002d]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      </div>
                    )}
                  </Link>
                  <div className="flex-grow p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/shows/${tmdbId}/${season}/${ep.episodeNumber}`} className="hover:text-[#e8002d] transition-colors">
                          <span className="text-[11px] text-[#e8002d] font-bold mr-2">E{String(ep.episodeNumber).padStart(2, "0")}</span>
                          <span className={`text-sm font-semibold ${watched ? "text-white/40 line-through" : "text-white"}`}>
                            {ep.title ?? `Episode ${ep.episodeNumber}`}
                          </span>
                        </Link>
                        <button
                          onClick={() => toggleEpisode(ep)}
                          className={`shrink-0 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-lg border transition-colors ${
                            watched
                              ? "text-white/40 border-white/10 hover:border-[#e8002d]/40 hover:text-white"
                              : "text-[#e8002d] border-[#e8002d]/40 hover:bg-[#e8002d] hover:text-white"
                          }`}
                        >
                          {watched ? "Watched" : "Watch"}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-white/40">
                        {ep.airDate && <span>{new Date(ep.airDate).toLocaleDateString()}</span>}
                        {ep.runtimeMin && <span>{ep.runtimeMin}m</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
