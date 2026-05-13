"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type ShowDetail, type ShowStatus, type EpisodeItem, type SeasonSummary } from "@/lib/api";
import { EpisodeRow } from "../episode-row";
import { WatchDatePicker } from "@/components/watch-date-picker";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

function formatAirTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const ampm = h! >= 12 ? "PM" : "AM";
  const hour = h! % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(date: string | null): string | null {
  if (!date) return null;
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatLanguage(code: string | null): string | null {
  if (!code) return null;
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; }
}

function formatCountry(code: string | null): string | null {
  if (!code) return null;
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; }
}

interface LoadedSeason {
  seasonNumber: number;
  posterPath: string | null;
  episodes: EpisodeItem[];
  watchedIds: Set<number>;
}

export default function AllSeasonsPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const { token, isLoading } = useAuth();
  const [show, setShow] = useState<ShowDetail | null>(null);
  const [status, setStatus] = useState<ShowStatus | null>(null);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [loadedSeasons, setLoadedSeasons] = useState<LoadedSeason[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [error, setError] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadedCountRef = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (isLoading || !token || !tmdbId) return;
    const id = Number(tmdbId);
    Promise.all([api.getShow(id, token), api.getShowSeasons(id, token)])
      .then(([showData, seasonsData]) => {
        setShow(showData.show);
        setStatus(showData.status);
        setSeasons(seasonsData.seasons);
      })
      .catch(() => setError("Failed to load show."));
  }, [isLoading, token, tmdbId]);

  useEffect(() => {
    if (show) {
      document.title = `Trakt - ${show.title} All Seasons`;
    }
  }, [show]);

  const loadNext = useCallback(async () => {
    if (loadingRef.current || !token || loadedCountRef.current >= seasons.length) return;
    loadingRef.current = true;
    setIsLoadingMore(true);
    const s = seasons[loadedCountRef.current]!;
    try {
      const data = await api.getSeason(Number(tmdbId), s.seasonNumber, token);
      setLoadedSeasons((prev) => [...prev, {
        seasonNumber: s.seasonNumber,
        posterPath: s.posterPath,
        episodes: data.episodes,
        watchedIds: new Set(data.watchedEpisodeIds),
      }]);
      loadedCountRef.current++;
    } catch {}
    loadingRef.current = false;
    setIsLoadingMore(false);
  }, [token, seasons, tmdbId]);

  // Load first season when data is ready
  useEffect(() => {
    if (seasons.length > 0) loadNext();
  }, [seasons.length, loadNext]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadNext(); },
      { rootMargin: "400px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [loadNext]);

  async function handleWatchlist() {
    const res = await api.toggleShowWatchlist(Number(tmdbId), status!.inWatchlist, token!);
    setStatus((s) => s && { ...s, inWatchlist: res.inWatchlist });
  }

  async function handleDropped() {
    const res = await api.toggleShowDropped(Number(tmdbId), token!);
    setStatus((s) => s && { ...s, inDropped: res.inDropped });
  }

  async function handleRewatch() {
    const res = await api.toggleShowRewatch(Number(tmdbId), token!);
    setStatus((s) => s && { ...s, inRewatch: res.inRewatch });
  }

  async function handleMarkWatched(watchedAt: string) {
    const res = await api.toggleShowWatched(Number(tmdbId), false, token!, watchedAt);
    setStatus((s) => s && { ...s, watched: res.watched });
  }

  async function handleRemoveWatched() {
    const res = await api.toggleShowWatched(Number(tmdbId), true, token!);
    setStatus((s) => s && { ...s, watched: res.watched });
  }

  async function handleRating(r: number) {
    if (!token) return;
    setRating(r);
    await api.upsertRating("show", Number(tmdbId), r, token).catch(() => {});
  }

  function toggleEpisode(seasonNumber: number, ep: EpisodeItem) {
    if (!token) return;
    const season = loadedSeasons.find((s) => s.seasonNumber === seasonNumber);
    if (!season) return;
    const wasWatched = season.watchedIds.has(ep.id);
    api.toggleEpisodeWatched(Number(tmdbId), seasonNumber, ep.episodeNumber, wasWatched, token)
      .then((res) => {
        setLoadedSeasons((prev) => prev.map((s) => {
          if (s.seasonNumber !== seasonNumber) return s;
          const next = new Set(s.watchedIds);
          res.watched ? next.add(ep.id) : next.delete(ep.id);
          return { ...s, watchedIds: next };
        }));
      })
      .catch(() => {});
  }

  if (error) return <p className="text-error">{error}</p>;
  if (!show || !status) return <p className="text-on-surface-variant">Loading…</p>;

  const backdropUrl = show.backdropPath ? `${TMDB_IMG}w1280${show.backdropPath}` : null;
  const posterUrl = show.posterPath ? `${TMDB_IMG}w342${show.posterPath}` : null;

  const airsOnPreceding = [show.airsDay, formatAirTime(show.airTime) ? `at ${formatAirTime(show.airTime)}` : null].filter(Boolean);
  const airsOnParts = [
    ...airsOnPreceding,
    show.network ? (airsOnPreceding.length > 0 ? `on ${show.network}` : show.network) : null,
  ].filter(Boolean);

  const totalEpisodes = seasons.reduce((sum, s) => sum + s.episodeCount, 0);

  return (
    <div className="w-full flex-1 overflow-x-hidden">
      <div className="-mx-margin-page -mt-stack-lg">
        {/* Hero */}
        <section className="relative h-[450px] md:h-[576px] w-full overflow-hidden">
          {backdropUrl ? (
            <Image src={backdropUrl} alt={show.title} fill priority className="object-cover object-top" />
          ) : (
            <div className="w-full h-full bg-surface-container-low" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-transparent to-[#0f0f0f]" />
          <div className="absolute bottom-0 left-0 w-full z-10 pb-8 md:pb-12">
            <div className="max-w-page mx-auto px-margin-page flex items-end gap-6">
              {posterUrl && (
                <div className="hidden md:block shrink-0 w-32 lg:w-40 aspect-[2/3] overflow-hidden shadow-2xl border border-white/10 relative">
                  <Image src={posterUrl} alt={show.title} fill className="object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  {show.genres.slice(0, 2).map((g) => (
                    <span key={g} className="bg-white/10 backdrop-blur-md text-white/80 px-3 py-1 rounded-full text-label-sm font-bold uppercase border border-white/10">{g}</span>
                  ))}
                  {show.network && (
                    <span className="text-white/40 text-label-sm uppercase tracking-widest">{show.network}</span>
                  )}
                </div>
                <Link href={`/shows/${tmdbId}`} className="hover:opacity-80 transition-opacity">
                  <h1 className="text-h1 font-black text-white drop-shadow-2xl">{show.title}</h1>
                </Link>
                <p className="text-white/60 text-lg font-semibold mt-1 mb-3">All Seasons</p>
                {show.overview && (
                  <p className="text-body-sm text-white/70 line-clamp-3">{show.overview}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-page mx-auto px-margin-page mt-12 grid grid-cols-1 lg:grid-cols-12 gap-stack-lg pb-16">
          <div className="lg:col-span-8 space-y-10">
            {/* Metadata */}
            <section className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              {show.status && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Status</p>
                  <p className="text-accent font-bold">{show.status}</p>
                </div>
              )}
              {airsOnParts.length > 0 && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Airs On</p>
                  <p className="text-white text-base">{airsOnParts.join(" ")}</p>
                </div>
              )}
              {show.firstAirDate && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Premiered</p>
                  <p className="text-white text-base">{formatDate(show.firstAirDate)}</p>
                </div>
              )}
              {show.runtimeMin && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Runtime</p>
                  <p className="text-white text-base">{show.runtimeMin} min</p>
                </div>
              )}
              {show.originCountry && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Country</p>
                  <p className="text-white text-base">{formatCountry(show.originCountry)}</p>
                </div>
              )}
              {show.originalLanguage && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Language</p>
                  <p className="text-white text-base">{formatLanguage(show.originalLanguage)}</p>
                </div>
              )}
            </section>

            {/* All Episodes */}
            <section>
              <h2 className="text-white font-black text-xl mb-6">
                All Episodes
                {totalEpisodes > 0 && (
                  <span className="text-white/30 font-normal text-base ml-2">({totalEpisodes})</span>
                )}
              </h2>

              {loadedSeasons.map((season) => (
                <div key={season.seasonNumber} className="mb-10">
                  <div className="flex items-center gap-4 mb-4">
                    <Link href={`/shows/${tmdbId}/seasons/${season.seasonNumber}`} className="hover:text-accent transition-colors">
                      <h3 className="text-white font-black text-lg">Season {season.seasonNumber}</h3>
                    </Link>
                    <span className="text-white/30 text-sm">{season.episodes.length} episode{season.episodes.length !== 1 ? "s" : ""}</span>
                  </div>
                  {season.episodes.map((ep) => (
                    <EpisodeRow
                      key={ep.id}
                      tmdbId={Number(tmdbId)}
                      seasonNumber={season.seasonNumber}
                      ep={ep}
                      watched={season.watchedIds.has(ep.id)}
                      onToggle={() => toggleEpisode(season.seasonNumber, ep)}
                    />
                  ))}
                </div>
              ))}

              {/* Sentinel + loading indicator */}
              <div ref={sentinelRef} className="h-4" />
              {isLoadingMore && (
                <div className="flex items-center justify-center py-8 text-white/30 text-sm">
                  <span className="material-symbols-outlined animate-spin mr-2 text-lg">progress_activity</span>
                  Loading season {loadedCountRef.current + 1}…
                </div>
              )}
              {!isLoadingMore && loadedSeasons.length === seasons.length && seasons.length > 0 && (
                <p className="text-white/20 text-xs text-center py-4">All {seasons.length} seasons loaded</p>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <div className="glass-panel rounded-3xl p-6 space-y-6 sticky top-24">
              <div>
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-accent">person</span>
                  Personal Tracking
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleWatchlist}
                    className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                      status.inWatchlist ? "bg-accent text-white" : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: status.inWatchlist ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
                    {status.inWatchlist ? "Watchlisted" : "Watchlist"}
                  </button>
                  <button
                    onClick={handleDropped}
                    className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                      status.inDropped ? "bg-accent text-white" : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">block</span>
                    {status.inDropped ? "Dropped" : "Drop"}
                  </button>
                  <button
                    onClick={handleRewatch}
                    className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                      status.inRewatch ? "bg-accent text-white" : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">replay</span>
                    {status.inRewatch ? "Rewatching" : "Rewatch"}
                  </button>
                  <div className="col-span-2">
                    <WatchDatePicker
                      watched={status.watched}
                      releaseDate={null}
                      onMark={handleMarkWatched}
                      onRemoveAll={handleRemoveWatched}
                      useReleaseDate={true}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-3">My Rating</label>
                <div className="flex gap-1 justify-between">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
                    <button key={star} onClick={() => handleRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} aria-label={`Rate ${star} out of 10`}>
                      <span className={`material-symbols-outlined text-sm cursor-pointer transition-colors ${star <= (hoverRating || rating) ? "text-accent" : "text-white/20"}`} style={{ fontVariationSettings: star <= (hoverRating || rating) ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                    </button>
                  ))}
                </div>
              </div>

              <Link
                href={`https://www.themoviedb.org/tv/${tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full border border-white/10 hover:border-accent/40 text-white/60 hover:text-accent py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all"
              >
                View on TMDB
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
