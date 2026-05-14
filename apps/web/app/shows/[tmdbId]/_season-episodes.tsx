// Episode list accordion — retained for the season detail page (not yet built)
"use client";

import Image from "next/image";
import { api, type EpisodeItem } from "@/lib/api";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

interface Props {
  tmdbId: number;
  seasonCount: number;
  token: string;
}

interface SeasonData {
  episodes: EpisodeItem[];
  watchedIds: number[];
}

// This component is not used yet. It will be integrated into the season detail page.
// It renders a season selector + episode grid with watched toggles.
export function SeasonEpisodeList({ tmdbId, seasonCount, token }: Props) {
  const [openSeason, setOpenSeason] = React.useState<number | null>(null);
  const [seasons, setSeasons] = React.useState<Record<number, SeasonData>>({});

  async function loadSeason(n: number) {
    if (seasons[n] || !token) return;
    const data = await api.getSeason(tmdbId, n, token);
    setSeasons((s) => ({ ...s, [n]: { episodes: data.episodes, watchedIds: data.watchedEpisodeIds } }));
  }

  async function toggleSeason(n: number) {
    await loadSeason(n);
    setOpenSeason((cur) => (cur === n ? null : n));
  }

  async function handleEpisodeWatched(seasonNum: number, ep: EpisodeItem) {
    const isWatched = seasons[seasonNum]?.watchedIds.includes(ep.id) ?? false;
    const res = await api.toggleEpisodeWatched(tmdbId, seasonNum, ep.episodeNumber, isWatched, token);
    setSeasons((s) => {
      const cur = s[seasonNum] ?? { episodes: [], watchedIds: [] };
      const watchedIds = res.watched ? [...cur.watchedIds, ep.id] : cur.watchedIds.filter((id) => id !== ep.id);
      return { ...s, [seasonNum]: { ...cur, watchedIds } };
    });
  }

  return (
    <section>
      <div className="flex items-center gap-stack-lg border-b border-outline-variant/30 pb-2 mb-6 overflow-x-auto">
        {Array.from({ length: seasonCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => toggleSeason(n)}
            className={`text-h3 pb-2 whitespace-nowrap transition-colors border-b-2 ${
              openSeason === n ? "text-on-surface border-accent" : "text-on-surface/40 border-transparent hover:text-on-surface"
            }`}
          >
            Season {n}
          </button>
        ))}
      </div>

      {openSeason !== null && seasons[openSeason] && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
          {seasons[openSeason].episodes.map((ep) => {
            const watched = seasons[openSeason].watchedIds.includes(ep.id);
            const stillUrl = ep.stillPath ? `${TMDB_IMG}w300${ep.stillPath}` : null;
            return (
              <div key={ep.id} className="bg-surface-container border border-outline-variant/30 overflow-hidden hover:border-outline-variant transition-all group">
                <div className="relative h-40 overflow-hidden">
                  {stillUrl ? (
                    <Image src={stillUrl} alt={ep.title ?? `Episode ${ep.episodeNumber}`} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl text-on-surface/20">tv</span>
                    </div>
                  )}
                  {ep.runtimeMin && (
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-[10px] font-bold text-white">{ep.runtimeMin} MIN</div>
                  )}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-on-surface/20">
                    <div className="bg-accent h-full" style={{ width: watched ? "100%" : "0%" }} />
                  </div>
                </div>
                <div className="p-4 flex justify-between items-start">
                  <div className="min-w-0">
                    <h3 className="text-on-surface font-bold text-sm line-clamp-1">
                      {ep.episodeNumber}. {ep.title ?? `Episode ${ep.episodeNumber}`}
                    </h3>
                  </div>
                  <button onClick={() => handleEpisodeWatched(openSeason, ep)} className="ml-2 shrink-0" aria-label={watched ? "Mark unwatched" : "Mark watched"}>
                    <span className={`material-symbols-outlined text-sm ${watched ? "text-accent" : "text-on-surface/20"}`} style={{ fontVariationSettings: watched ? "'FILL' 1" : "'FILL' 0" }}>check_circle</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openSeason === null && (
        <p className="text-on-surface/40 text-sm">Select a season above to view episodes.</p>
      )}
    </section>
  );
}

import * as React from "react";
