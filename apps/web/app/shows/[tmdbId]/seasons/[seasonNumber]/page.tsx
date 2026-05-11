"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type ShowDetail, type ShowStatus, type EpisodeItem } from "@/lib/api";
import { EpisodeRow } from "../episode-row";
import { RefreshButton } from "@/components/refresh-button";
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

export default function SeasonDetailPage() {
  const { tmdbId, seasonNumber: snStr } = useParams<{ tmdbId: string; seasonNumber: string }>();
  const sn = Number(snStr);
  const { token, isLoading } = useAuth();
  const [show, setShow] = useState<ShowDetail | null>(null);
  const [status, setStatus] = useState<ShowStatus | null>(null);
  const [seasonPoster, setSeasonPoster] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token || !tmdbId) return;
    const id = Number(tmdbId);
    Promise.all([
      api.getShow(id, token),
      api.getSeason(id, sn, token),
      api.getShowSeasons(id, token),
    ]).then(([showData, seasonData, seasonsData]) => {
      setShow(showData.show);
      setStatus(showData.status);
      setEpisodes(seasonData.episodes);
      setWatchedIds(new Set(seasonData.watchedEpisodeIds));
      const s = seasonsData.seasons.find((s) => s.seasonNumber === sn);
      setSeasonPoster(s?.posterPath ?? null);
    }).catch(() => setError("Failed to load season."));
  }, [isLoading, token, tmdbId, sn]);


  async function handleMarkSeason(watchedAt: string) {
    if (!token) return;
    const allEpisodeIds = episodes.map(ep => ep.id);

    setWatchedIds((prev) => {
      const next = new Set(prev);
      allEpisodeIds.forEach(id => next.add(id));
      return next;
    });

    Promise.all(
      episodes.map((ep) => {
        const dateToUse = watchedAt === 'release_date' ? (ep.airDate ?? new Date().toISOString().split('T')[0]) : watchedAt;
        return api.toggleEpisodeWatched(Number(tmdbId), sn, ep.episodeNumber, false, token, dateToUse);
      })
    ).catch(() => {});
  }

  async function handleRemoveSeason() {
    if (!token) return;
    const allEpisodeIds = episodes.map(ep => ep.id);

    setWatchedIds((prev) => {
      const next = new Set(prev);
      allEpisodeIds.forEach(id => next.delete(id));
      return next;
    });

    Promise.all(
      episodes.map((ep) =>
        api.toggleEpisodeWatched(Number(tmdbId), sn, ep.episodeNumber, true, token)
      )
    ).catch(() => {});
  }


  function toggleEpisode(ep: EpisodeItem) {
    if (!token) return;
    const wasWatched = watchedIds.has(ep.id);
    api.toggleEpisodeWatched(Number(tmdbId), sn, ep.episodeNumber, wasWatched, token)
      .then((res) => {
        setWatchedIds((prev) => {
          const next = new Set(prev);
          res.watched ? next.add(ep.id) : next.delete(ep.id);
          return next;
        });
      })
      .catch(() => {});
  }

  async function handleRefreshEpisodes() {
    if (!token) return;
    await api.refreshShowSeasons(Number(tmdbId), token);
    const result = await api.getSeason(Number(tmdbId), sn, token);
    setEpisodes(result.episodes);
    setWatchedIds(new Set(result.watchedEpisodeIds));
  }

  async function handleRefreshAll() {
    await handleRefreshEpisodes();
  }

  if (error) return <p className="text-error">{error}</p>;
  if (!show || !status) return <p className="text-on-surface-variant">Loading…</p>;

  const backdropUrl = show.backdropPath ? `${TMDB_IMG}w1280${show.backdropPath}` : null;
  const posterUrl = seasonPoster
    ? `${TMDB_IMG}w342${seasonPoster}`
    : show.posterPath ? `${TMDB_IMG}w342${show.posterPath}` : null;

  const airsOnPreceding = [show.airsDay, formatAirTime(show.airTime) ? `at ${formatAirTime(show.airTime)}` : null].filter(Boolean);
  const airsOnParts = [
    ...airsOnPreceding,
    show.network ? (airsOnPreceding.length > 0 ? `on ${show.network}` : show.network) : null,
  ].filter(Boolean);

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
                  <Image src={posterUrl} alt={`Season ${sn}`} fill className="object-cover" />
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
                <p className="text-white/60 text-lg font-semibold mt-1 mb-3">Season {sn}</p>
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

            {/* Episodes */}
            <section>
              <h2 className="text-white font-black text-xl mb-6">
                Episodes
                {episodes.length > 0 && (
                  <span className="text-white/30 font-normal text-base ml-2">({episodes.length})</span>
                )}
              </h2>
              <div>
                {episodes.map((ep) => (
                  <EpisodeRow
                    key={ep.id}
                    tmdbId={Number(tmdbId)}
                    seasonNumber={sn}
                    ep={ep}
                    watched={watchedIds.has(ep.id)}
                    onToggle={() => toggleEpisode(ep)}
                  />
                ))}
              </div>
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
                <div className="space-y-2">
                  {(() => {
                    const allEpisodeIds = episodes.map(ep => ep.id);
                    const allWatched = allEpisodeIds.every(id => watchedIds.has(id));
                    return (
                      <WatchDatePicker
                        watched={allWatched}
                        releaseDate={null}
                        onMark={handleMarkSeason}
                        onRemoveAll={handleRemoveSeason}
                        useReleaseDate={true}
                      />
                    );
                  })()}
                </div>
              </div>

              <Link
                href={`https://www.themoviedb.org/tv/${tmdbId}/season/${sn}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full border border-white/10 hover:border-accent/40 text-white/60 hover:text-accent py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all"
              >
                View on TMDB
              </Link>

              <div className="border-t border-white/10 pt-4">
                <RefreshButton sections={[
                  { label: "All Data", onRefresh: handleRefreshAll },
                  { label: "Episodes", onRefresh: handleRefreshEpisodes },
                ]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
