"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type ShowDetail, type ShowStatus, type EpisodeItem } from "@/lib/api";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

export default function ShowDetailPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const { token, isLoading } = useAuth();
  const [show, setShow] = useState<ShowDetail | null>(null);
  const [status, setStatus] = useState<ShowStatus | null>(null);
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<Record<number, { episodes: EpisodeItem[]; watchedIds: number[] }>>({});
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token || !tmdbId) return;
    api.getShow(Number(tmdbId), token)
      .then((data) => { setShow(data.show); setStatus(data.status); })
      .catch(() => setError("Failed to load show."));
  }, [isLoading, token, tmdbId]);

  async function loadSeason(n: number) {
    if (seasons[n] || !token) return;
    const data = await api.getSeason(Number(tmdbId), n, token);
    setSeasons((s) => ({ ...s, [n]: { episodes: data.episodes, watchedIds: data.watchedEpisodeIds } }));
  }

  async function toggleSeason(n: number) {
    await loadSeason(n);
    setOpenSeason((cur) => (cur === n ? null : n));
  }

  async function handleEpisodeWatched(seasonNum: number, ep: EpisodeItem) {
    const isWatched = seasons[seasonNum]?.watchedIds.includes(ep.id) ?? false;
    const res = await api.toggleEpisodeWatched(Number(tmdbId), seasonNum, ep.episodeNumber, isWatched, token!);
    setSeasons((s) => {
      const cur = s[seasonNum] ?? { episodes: [], watchedIds: [] };
      const watchedIds = res.watched ? [...cur.watchedIds, ep.id] : cur.watchedIds.filter((id) => id !== ep.id);
      return { ...s, [seasonNum]: { ...cur, watchedIds } };
    });
  }

  async function handleWatchlist() {
    const res = await api.toggleShowWatchlist(Number(tmdbId), status!.inWatchlist, token!);
    setStatus((s) => s && { ...s, inWatchlist: res.inWatchlist });
  }

  async function handleCollection() {
    const res = await api.toggleShowCollection(Number(tmdbId), status!.inCollection, token!);
    setStatus((s) => s && { ...s, inCollection: res.inCollection });
  }

  async function handleRating(r: number) {
    if (!token) return;
    setRating(r);
    await api.upsertRating("show", Number(tmdbId), r, token).catch(() => {});
  }

  if (error) return <p className="text-error">{error}</p>;
  if (!show || !status) return <p className="text-on-surface-variant">Loading…</p>;

  const backdropUrl = show.backdropPath ? `${TMDB_IMG}w1280${show.backdropPath}` : null;

  return (
    <div className="-mx-margin-page -mt-stack-lg">
      {/* Cinematic Hero */}
      <section className="relative h-[500px] md:h-[640px] w-full overflow-hidden">
        {backdropUrl ? (
          <Image src={backdropUrl} alt={show.title} fill priority className="object-cover" />
        ) : (
          <div className="w-full h-full bg-surface-container-low" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-transparent to-[#0f0f0f]" />

        {/* Bottom-left overlay */}
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 z-10">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {show.genres.slice(0, 2).map((g) => (
                <span key={g} className="bg-white/10 backdrop-blur-md text-white/80 px-3 py-1 rounded-full text-label-sm font-bold uppercase border border-white/10">{g}</span>
              ))}
              {show.network && (
                <span className="text-white/40 text-label-sm uppercase tracking-widest">{show.network}</span>
              )}
            </div>
            <h1 className="text-h1 font-black text-white mb-3 drop-shadow-2xl">{show.title}</h1>
            {show.overview && (
              <p className="text-body-md text-white/70 max-w-2xl mb-6 line-clamp-2">{show.overview}</p>
            )}
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleWatchlist}
                className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg ${
                  status.inWatchlist
                    ? "bg-[#e8002d] text-white shadow-[#e8002d]/30"
                    : "bg-[#e8002d] text-white shadow-[#e8002d]/20 hover:shadow-[#e8002d]/40"
                }`}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: status.inWatchlist ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
                {status.inWatchlist ? "In Watchlist" : "Watchlist"}
              </button>
              <button
                onClick={handleCollection}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 text-white font-bold px-8 py-3 rounded-xl flex items-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined text-sm">library_add</span>
                {status.inCollection ? "In Collection" : "Collection"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-page mx-auto px-margin-page mt-12 grid grid-cols-1 lg:grid-cols-12 gap-stack-lg pb-16">
        {/* Left: Seasons & Episodes */}
        <div className="lg:col-span-8 space-y-stack-lg">
          {show.seasonCount > 0 && (
            <section>
              <div className="flex items-center gap-stack-lg border-b border-white/5 pb-2 mb-6 overflow-x-auto">
                {Array.from({ length: show.seasonCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => toggleSeason(n)}
                    className={`text-h3 pb-2 whitespace-nowrap transition-colors border-b-2 ${
                      openSeason === n ? "text-white border-[#e8002d]" : "text-white/40 border-transparent hover:text-white"
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
                      <div key={ep.id} className="bg-[#181818] border border-white/5 rounded-2xl overflow-hidden hover:border-white/20 transition-all group">
                        <div className="relative h-40 overflow-hidden">
                          {stillUrl ? (
                            <Image src={stillUrl} alt={ep.title ?? `Episode ${ep.episodeNumber}`} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                              <span className="material-symbols-outlined text-3xl text-white/20">tv</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-white text-5xl">play_circle</span>
                          </div>
                          {ep.runtimeMin && (
                            <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-[10px] font-bold text-white">
                              {ep.runtimeMin} MIN
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
                            <div className="bg-[#e8002d] h-full" style={{ width: watched ? "100%" : "0%" }} />
                          </div>
                        </div>
                        <div className="p-4 flex justify-between items-start">
                          <div className="min-w-0">
                            <h3 className="text-white font-bold text-sm line-clamp-1">
                              {ep.episodeNumber}. {ep.title ?? `Episode ${ep.episodeNumber}`}
                            </h3>
                          </div>
                          <button
                            onClick={() => handleEpisodeWatched(openSeason, ep)}
                            className="ml-2 shrink-0"
                            aria-label={watched ? "Mark unwatched" : "Mark watched"}
                          >
                            <span
                              className={`material-symbols-outlined text-sm ${watched ? "text-[#e8002d]" : "text-white/20"}`}
                              style={{ fontVariationSettings: watched ? "'FILL' 1" : "'FILL' 0" }}
                            >
                              check_circle
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {openSeason === null && (
                <p className="text-white/40 text-sm">Select a season above to view episodes.</p>
              )}
            </section>
          )}
        </div>

        {/* Right: Personal Management Sidebar */}
        <div className="lg:col-span-4">
          <div className="glass-panel rounded-3xl p-6 space-y-6 sticky top-24">
            <div>
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#e8002d]">person</span>
                Personal Tracking
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleWatchlist}
                  className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                    status.inWatchlist ? "bg-[#e8002d] text-white" : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: status.inWatchlist ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
                  {status.inWatchlist ? "Watchlisted" : "Watchlist"}
                </button>
                <button
                  onClick={handleCollection}
                  className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                    status.inCollection ? "bg-[#e8002d] text-white" : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">library_add</span>
                  {status.inCollection ? "Collected" : "Collect"}
                </button>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-3">My Rating</label>
              <div className="flex gap-1 justify-between">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`Rate ${star} out of 10`}
                  >
                    <span
                      className={`material-symbols-outlined text-sm cursor-pointer transition-colors ${
                        star <= (hoverRating || rating) ? "text-[#e8002d]" : "text-white/20"
                      }`}
                      style={{ fontVariationSettings: star <= (hoverRating || rating) ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      star
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 space-y-3 text-xs">
              {show.status && (
                <div className="flex justify-between items-center">
                  <span className="text-white/40">Status</span>
                  <span className="text-[#e8002d] font-bold bg-[#e8002d]/10 px-2 py-0.5 rounded">{show.status}</span>
                </div>
              )}
              {show.year > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-white/40">Year</span>
                  <span className="text-white">{show.year}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-white/40">Seasons</span>
                <span className="text-white">{show.seasonCount}</span>
              </div>
            </div>

            <Link
              href={`https://www.themoviedb.org/tv/${tmdbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full border border-white/10 hover:border-[#e8002d]/40 text-white/60 hover:text-[#e8002d] py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all"
            >
              View on TMDB
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
