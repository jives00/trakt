"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type ShowDetail, type ShowStatus, type EpisodeItem, type CastMember, type ShowEpisodeSummary } from "@/lib/api";

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

function EpisodeThumb({ ep, label, showLabel = true }: { ep: ShowEpisodeSummary; label: string; showLabel?: boolean }) {
  const stillUrl = ep.stillPath ? `${TMDB_IMG}w300${ep.stillPath}` : null;
  return (
    <div>
      <div className="pb-3 mb-3 border-b border-white/5">
        <span className={`pb-1 text-sm font-bold border-b-2 ${showLabel ? "text-white border-[#e8002d]" : "text-transparent border-transparent"}`}>{label}</span>
      </div>
      <div className="bg-[#181818] border border-white/5 rounded-xl overflow-hidden">
        <div className="relative aspect-video overflow-hidden">
          {stillUrl ? (
            <Image src={stillUrl} alt={ep.title ?? ""} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl text-white/20">tv</span>
            </div>
          )}
          {ep.runtimeMin && (
            <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[9px] font-bold text-white">{ep.runtimeMin}m</div>
          )}
        </div>
        <div className="p-3">
          <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-0.5">S{ep.seasonNumber} E{ep.episodeNumber}</p>
          <p className="text-white text-base font-bold line-clamp-1">{ep.title ?? `Episode ${ep.episodeNumber}`}</p>
          {ep.airDate && <p className="text-white/40 text-xs mt-0.5">{formatDate(ep.airDate)}</p>}
        </div>
      </div>
    </div>
  );
}

export default function ShowDetailPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const { token, isLoading } = useAuth();
  const [show, setShow] = useState<ShowDetail | null>(null);
  const [status, setStatus] = useState<ShowStatus | null>(null);
  const [upNext, setUpNext] = useState<ShowEpisodeSummary | null | undefined>(undefined);
  const [recentEps, setRecentEps] = useState<ShowEpisodeSummary[]>([]);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [castTab, setCastTab] = useState<"regulars" | "guests">("regulars");
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<Record<number, { episodes: EpisodeItem[]; watchedIds: number[] }>>({});
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token || !tmdbId) return;
    const id = Number(tmdbId);
    api.getShow(id, token)
      .then((data) => { setShow(data.show); setStatus(data.status); })
      .catch(() => setError("Failed to load show."));
    api.getShowUpNext(id, token).then((d) => setUpNext(d.episode)).catch(() => setUpNext(null));
    api.getShowRecentEpisodes(id, token).then((d) => setRecentEps(d.episodes)).catch(() => {});
    api.getShowCast(id, token).then((d) => setCast(d.cast)).catch(() => {});
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

  async function handleWatched() {
    const res = await api.toggleShowWatched(Number(tmdbId), status!.watched, token!);
    setStatus((s) => s && { ...s, watched: res.watched });
  }

  async function handleRating(r: number) {
    if (!token) return;
    setRating(r);
    await api.upsertRating("show", Number(tmdbId), r, token).catch(() => {});
  }

  if (error) return <p className="text-error">{error}</p>;
  if (!show || !status) return <p className="text-on-surface-variant">Loading…</p>;

  const backdropUrl = show.backdropPath ? `${TMDB_IMG}w1280${show.backdropPath}` : null;

  const airsOnPreceding = [show.airsDay, formatAirTime(show.airTime) ? `at ${formatAirTime(show.airTime)}` : null].filter(Boolean);
  const airsOnParts = [
    ...airsOnPreceding,
    show.network ? (airsOnPreceding.length > 0 ? `on ${show.network}` : show.network) : null,
  ].filter(Boolean);

  const episodeEls = [
    upNext ? { ep: upNext, label: "Up Next" } : null,
    ...recentEps.map((ep) => ({ ep, label: "Recently Aired" })),
  ].filter(Boolean) as { ep: ShowEpisodeSummary; label: string }[];

  const regulars = cast.filter((m) => m.isRegular);
  const guests = cast.filter((m) => !m.isRegular);
  const displayedCast = castTab === "regulars" ? regulars : guests.slice(0, 24);

  return (
    <div className="w-full flex-1 overflow-x-hidden">
      <div className="-mx-margin-page -mt-stack-lg">
        {/* Hero */}
        <section className="relative h-[450px] md:h-[576px] w-full overflow-hidden">
          {backdropUrl ? (
            <Image src={backdropUrl} alt={show.title} fill priority className="object-cover" />
          ) : (
            <div className="w-full h-full bg-surface-container-low" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-transparent to-[#0f0f0f]" />

          <div className="absolute bottom-0 left-0 w-full z-10 pb-8 md:pb-12">
            <div className="max-w-page mx-auto px-margin-page flex items-end gap-6">
              {show.posterPath && (
                <div className="relative hidden md:block shrink-0 w-32 lg:w-40 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-white/10">
                  <Image src={`${TMDB_IMG}w342${show.posterPath}`} alt={show.title} fill className="object-cover" />
                </div>
              )}
              <div className="min-w-0">
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
                  <p className="text-body-sm text-white/70 line-clamp-3">{show.overview}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-page mx-auto px-margin-page mt-12 grid grid-cols-1 lg:grid-cols-12 gap-stack-lg pb-16">
          {/* Left */}
          <div className="lg:col-span-8 space-y-10">

            {/* Metadata */}
            <section className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              {show.status && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Status</p>
                  <p className="text-[#e8002d] font-bold">{show.status}</p>
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

            {/* Episode highlights */}
            {episodeEls.length > 0 && (
              <section>
                <div className="grid grid-cols-3 gap-4">
                  {episodeEls.slice(0, 3).map(({ ep, label }, i) => (
                    <EpisodeThumb key={ep.episodeId} ep={ep} label={label} showLabel={i < 2} />
                  ))}
                </div>
              </section>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <section>
                <div className="flex gap-6 border-b border-white/5 mb-6">
                  {(["regulars", "guests"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setCastTab(tab)}
                      className={`pb-2 text-sm font-bold border-b-2 transition-colors ${
                        castTab === tab ? "text-white border-[#e8002d]" : "text-white/40 border-transparent hover:text-white"
                      }`}
                    >
                      {tab === "regulars" ? `Series Regulars (${regulars.length})` : `Guest Stars (${guests.length})`}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {displayedCast.map((m) => (
                    <div key={m.tmdbId} className="text-center">
                      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-surface-container-high mb-2">
                        {m.profilePath ? (
                          <Image src={`${TMDB_IMG}w185${m.profilePath}`} alt={m.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl text-white/20">person</span>
                          </div>
                        )}
                      </div>
                      <p className="text-white text-xs font-bold line-clamp-1">{m.name}</p>
                      <p className="text-white/40 text-sm line-clamp-1">{m.character}</p>
                      <p className="text-white/30 text-sm">{m.episodeCount} ep{m.episodeCount !== 1 ? "s" : ""}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Seasons */}
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
                            {ep.runtimeMin && (
                              <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-[10px] font-bold text-white">{ep.runtimeMin} MIN</div>
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
                            <button onClick={() => handleEpisodeWatched(openSeason, ep)} className="ml-2 shrink-0" aria-label={watched ? "Mark unwatched" : "Mark watched"}>
                              <span className={`material-symbols-outlined text-sm ${watched ? "text-[#e8002d]" : "text-white/20"}`} style={{ fontVariationSettings: watched ? "'FILL' 1" : "'FILL' 0" }}>check_circle</span>
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

          {/* Right: Sidebar */}
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
                  <button
                    onClick={handleWatched}
                    className={`col-span-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                      status.watched ? "bg-[#e8002d] text-white" : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: status.watched ? "'FILL' 1" : "'FILL' 0" }}>check_circle</span>
                    {status.watched ? "Watched" : "Mark Watched"}
                  </button>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-3">My Rating</label>
                <div className="flex gap-1 justify-between">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
                    <button key={star} onClick={() => handleRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} aria-label={`Rate ${star} out of 10`}>
                      <span className={`material-symbols-outlined text-sm cursor-pointer transition-colors ${star <= (hoverRating || rating) ? "text-[#e8002d]" : "text-white/20"}`} style={{ fontVariationSettings: star <= (hoverRating || rating) ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                    </button>
                  ))}
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
    </div>
  );
}
