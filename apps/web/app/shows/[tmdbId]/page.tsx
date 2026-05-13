"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type ShowDetail, type ShowStatus, type CastMember, type ShowEpisodeSummary, type SeasonSummary } from "@/lib/api";
import { ImagePickerModal } from "@/components/image-picker-modal";
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

function EpisodeThumb({ showTmdbId, ep, label, showLabel = true }: { showTmdbId: number; ep: ShowEpisodeSummary; label: string; showLabel?: boolean }) {
  const stillUrl = ep.stillPath ? `${TMDB_IMG}w300${ep.stillPath}` : null;
  const href = `/shows/${showTmdbId}/seasons/${ep.seasonNumber}/episodes/${ep.episodeNumber}`;
  return (
    <Link href={href}>
      <div>
        <div className="pb-3 mb-3 border-b border-white/5">
          <span className={`pb-1 text-sm font-bold border-b-2 ${showLabel ? "text-white border-accent" : "text-transparent border-transparent"}`}>{label}</span>
        </div>
        <div className="bg-surface-container-high border border-white/5 overflow-hidden hover:border-white/10 transition-colors cursor-pointer">
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
    </Link>
  );
}

function EditImageButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
    >
      <span className="bg-black/70 border border-white/20 rounded-full p-2 text-white backdrop-blur-sm">
        <span className="material-symbols-outlined text-base leading-none" style={{ fontVariationSettings: "'FILL' 0" }}>edit</span>
      </span>
    </button>
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
  const [castLoading, setCastLoading] = useState(false);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [watchedEpisodeCount, setWatchedEpisodeCount] = useState(0);
  const [totalEpisodeCount, setTotalEpisodeCount] = useState(0);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<"hero" | "poster" | null>(null);

  useEffect(() => {
    if (isLoading || !token || !tmdbId) return;
    const id = Number(tmdbId);
    api.getShow(id, token)
      .then((data) => { setShow(data.show); setStatus(data.status); })
      .catch(() => setError("Failed to load show."));
    api.getShowUpNext(id, token).then((d) => setUpNext(d.episode)).catch(() => setUpNext(null));
    api.getShowRecentEpisodes(id, token).then((d) => setRecentEps(d.episodes)).catch(() => {});

    setCastLoading(true);
    api.getShowCast(id, token)
      .then((d) => setCast(d.cast))
      .catch(() => {})
      .finally(() => setCastLoading(false));

    setSeasonsLoading(true);
    api.getShowSeasons(id, token)
      .then((d) => {
        setSeasons(d.seasons);
        const total = d.seasons.reduce((sum, s) => sum + s.episodeCount, 0);
        setTotalEpisodeCount(total);
        if (d.seasons.length === 0) {
          return api.refreshShowSeasons(id, token).then(() => api.getShowSeasons(id, token));
        }
        return Promise.resolve(d);
      })
      .then((d) => {
        setSeasons(d.seasons);
        const total = d.seasons.reduce((sum, s) => sum + s.episodeCount, 0);
        setTotalEpisodeCount(total);
        return Promise.all(
          d.seasons.map((s) => api.getSeason(id, s.seasonNumber, token))
        );
      })
      .then((seasonResults) => {
        const watchedCount = seasonResults.reduce((sum, result) => sum + result.watchedEpisodeIds.length, 0);
        setWatchedEpisodeCount(watchedCount);
      })
      .catch(() => {})
      .finally(() => setSeasonsLoading(false));
  }, [isLoading, token, tmdbId]);

  useEffect(() => {
    if (show) {
      document.title = `Trakt - ${show.title}`;
    }
  }, [show]);

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

  async function handleMarkShowWatched(watchedAt: string) {
    const res = await api.toggleShowWatched(Number(tmdbId), false, token!, watchedAt);
    setStatus((s) => s && { ...s, watched: res.watched });
  }

  async function handleRemoveShowWatched() {
    const res = await api.toggleShowWatched(Number(tmdbId), true, token!);
    setStatus((s) => s && { ...s, watched: res.watched });
  }

  async function handleRating(r: number) {
    if (!token) return;
    setRating(r);
    await api.upsertRating("show", Number(tmdbId), r, token).catch(() => {});
  }

  function handleImageSaved(imageType: "hero" | "poster", path: string) {
    setShow((s) => s
      ? { ...s, backdropPath: imageType === "hero" ? path : s.backdropPath, posterPath: imageType === "poster" ? path : s.posterPath }
      : null);
  }

  async function handleRefreshShowMetadata() {
    if (!token) return;
    const result = await api.refreshShowMetadata(Number(tmdbId), token);
    setShow(result.show);
  }

  async function handleRefreshSeasons() {
    if (!token) return;
    await api.refreshShowSeasons(Number(tmdbId), token);
    const seasonsData = await api.getShowSeasons(Number(tmdbId), token);
    setSeasons(seasonsData.seasons);
  }

  async function handleRefreshCast() {
    if (!token) return;
    const result = await api.refreshShowCast(Number(tmdbId), token);
    setCast(result.cast);
  }

  async function handleRefreshAll() {
    await handleRefreshShowMetadata();
    await handleRefreshCast();
    await handleRefreshSeasons();
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
        <section className="relative h-[450px] md:h-[576px] w-full overflow-hidden group/hero">
          {backdropUrl ? (
            <Image src={backdropUrl} alt={show.title} fill priority className="object-cover object-top" />
          ) : (
            <div className="w-full h-full bg-surface-container-low" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f]/25 via-[#0f0f0f]/5 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f]/25 via-transparent to-[#0f0f0f]/25" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />

          {/* Hero edit button */}
          <button
            onClick={() => setPicker("hero")}
            aria-label="Change backdrop image"
            className="absolute top-14 right-16 z-20 flex items-center gap-1.5 bg-black/60 border border-white/20 rounded-full px-3 py-2 text-white backdrop-blur-sm opacity-20 group-hover/hero:opacity-100 transition-opacity hover:border-accent/60 hover:text-accent"
          >
            <span className="material-symbols-outlined text-base leading-none" style={{ fontVariationSettings: "'FILL' 0" }}>edit</span>
            <span className="text-sm font-bold">Backdrop</span>
          </button>

          <div className="absolute bottom-0 left-0 w-full z-10 pb-8 md:pb-12">
            <div className="max-w-page mx-auto px-margin-page flex items-end gap-6">
              {show.posterPath && (
                <div className="relative group/poster hidden md:block shrink-0 w-32 lg:w-40 aspect-[2/3] overflow-hidden shadow-2xl border border-white/10">
                  <Image src={`${TMDB_IMG}w342${show.posterPath}`} alt={show.title} fill className="object-cover" />
                  <EditImageButton onClick={() => setPicker("poster")} label="Change poster image" />
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

            {/* Episode highlights */}
            {episodeEls.length > 0 && (
              <section>
                <div className="grid grid-cols-3 gap-4">
                  {episodeEls.slice(0, 3).map(({ ep, label }, i) => (
                    <EpisodeThumb key={ep.episodeId} showTmdbId={Number(tmdbId)} ep={ep} label={label} showLabel={i < 2} />
                  ))}
                </div>
              </section>
            )}

            {/* Cast */}
            {(cast.length > 0 || castLoading) && (
              <section>
                <div className="flex gap-6 border-b border-white/5 mb-6 justify-between items-center">
                  <div className="flex gap-6">
                    {cast.length > 0 ? (
                      (["regulars", "guests"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setCastTab(tab)}
                          className={`pb-2 text-sm font-bold border-b-2 transition-colors ${
                            castTab === tab ? "text-white border-accent" : "text-white/40 border-transparent hover:text-white"
                          }`}
                        >
                          {tab === "regulars" ? `Series Regulars (${regulars.length})` : `Guest Stars (${guests.length})`}
                        </button>
                      ))
                    ) : (
                      <span className="text-white/40 text-sm">Loading cast…</span>
                    )}
                  </div>
                </div>
                {castLoading && cast.length === 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="text-center">
                        <div className="relative w-full aspect-[2/3] overflow-hidden bg-surface-container-high mb-2 border border-white/5 animate-pulse" />
                        <div className="h-3 bg-surface-container-high rounded mb-2 animate-pulse" />
                        <div className="h-2 bg-surface-container-high rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {displayedCast.map((m) => (
                      <a
                        key={m.tmdbId}
                        href={`https://www.themoviedb.org/person/${m.tmdbId}-${m.name.toLowerCase().replace(/\s+/g, "-")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-center group cursor-pointer"
                      >
                        <div className="relative w-full aspect-[2/3] overflow-hidden bg-surface-container-high mb-2 border border-white/5 group-hover:border-white/20 transition-colors">
                          {m.profilePath ? (
                            <Image src={`${TMDB_IMG}w185${m.profilePath}`} alt={m.name} fill sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw" className="object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-2xl text-white/20">person</span>
                            </div>
                          )}
                        </div>
                        <p className="text-white text-xs font-bold line-clamp-1 group-hover:text-accent transition-colors">{m.name}</p>
                        <p className="text-white/40 text-sm line-clamp-1">{m.character}</p>
                        <p className="text-white/30 text-sm">{m.episodeCount} ep{m.episodeCount !== 1 ? "s" : ""}</p>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Seasons */}
            {(seasons.length > 0 || seasonsLoading) && (
              <section>
                <h2 className="text-white font-black text-xl mb-6">Seasons {seasonsLoading && seasons.length === 0 && <span className="text-white/40 text-lg font-normal">(loading…)</span>}</h2>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {seasonsLoading && seasons.length === 0 ? (
                    <>
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i}>
                          <div className="relative aspect-[2/3] overflow-hidden bg-surface-container-high mb-2 border border-white/5 animate-pulse" />
                          <div className="h-3 bg-surface-container-high rounded mb-2 animate-pulse" />
                          <div className="h-2 bg-surface-container-high rounded animate-pulse" />
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <Link href={`/shows/${tmdbId}/seasons/all`} className="group">
                        <div className="relative aspect-[2/3] overflow-hidden bg-surface-container-high mb-2 border border-white/5 group-hover:border-white/20 transition-colors">
                          {show.posterPath ? (
                            <Image src={`${TMDB_IMG}w342${show.posterPath}`} alt="All Seasons" fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-3xl text-white/20">tv</span>
                            </div>
                          )}
                        </div>
                        <p className="text-white text-xs font-bold">All Seasons</p>
                        <p className="text-white/40 text-xs">{seasons.reduce((sum, s) => sum + s.episodeCount, 0)} episodes</p>
                      </Link>
                      {seasons.map((s) => (
                        <Link key={s.seasonNumber} href={`/shows/${tmdbId}/seasons/${s.seasonNumber}`} className="group">
                          <div className="relative aspect-[2/3] overflow-hidden bg-surface-container-high mb-2 border border-white/5 group-hover:border-white/20 transition-colors">
                            {s.posterPath ? (
                              <Image src={`${TMDB_IMG}w342${s.posterPath}`} alt={`Season ${s.seasonNumber}`} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-3xl text-white/20">tv</span>
                              </div>
                            )}
                          </div>
                          <p className="text-white text-xs font-bold">Season {s.seasonNumber}</p>
                          <p className="text-white/40 text-xs">{s.episodeCount} episode{s.episodeCount !== 1 ? "s" : ""}</p>
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right: Sidebar */}
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
                      watched={watchedEpisodeCount === totalEpisodeCount && totalEpisodeCount > 0}
                      releaseDate={null}
                      onMark={handleMarkShowWatched}
                      onRemoveAll={handleRemoveShowWatched}
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

              <div className="space-y-2">
                {show.rtCriticScore != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40 font-bold">IMDb</span>
                    <span className="text-white">{(show.rtCriticScore / 10).toFixed(1)}/10</span>
                  </div>
                )}
                {show.tmdbRating != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40 font-bold">TMDB</span>
                    <span className="text-white">{(show.tmdbRating / 10).toFixed(1)}/10</span>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-4">
                <RefreshButton sections={[
                  { label: "All Data", onRefresh: handleRefreshAll },
                  { label: "Metadata", onRefresh: handleRefreshShowMetadata },
                  { label: "Cast", onRefresh: handleRefreshCast },
                  { label: "Seasons", onRefresh: handleRefreshSeasons },
                ]} />
              </div>

              <Link
                href={`https://www.themoviedb.org/tv/${tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full border border-white/10 hover:border-accent/40 text-white/60 hover:text-accent py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all"
              >
                View on TMDB
              </Link>
              {show.imdbId && (
                <Link
                  href={`https://www.imdb.com/title/${show.imdbId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full border border-white/10 hover:border-accent/40 text-white/60 hover:text-accent py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all"
                >
                  View on IMDb
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {picker && (
        <ImagePickerModal
          open
          onClose={() => setPicker(null)}
          tmdbId={Number(tmdbId)}
          imageType={picker}
          mediaType="show"
          onSaved={(path) => handleImageSaved(picker, path)}
        />
      )}
    </div>
  );
}
