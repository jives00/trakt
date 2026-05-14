"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type ShowDetail, type ShowStatus, type EpisodeDetail, type CastMember, type SeasonSummary, type HistoryItem } from "@/lib/api";
import { RefreshButton } from "@/components/refresh-button";
import { WatchDatePicker } from "@/components/watch-date-picker";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

function formatDate(date: string | null): string | null {
  if (!date) return null;
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function EpisodeDetailPage() {
  const { tmdbId, seasonNumber: snStr, episodeNumber: epStr } = useParams<{ tmdbId: string; seasonNumber: string; episodeNumber: string }>();
  const sn = Number(snStr);
  const ep = Number(epStr);
  const router = useRouter();
  const { token, isLoading } = useAuth();
  const [show, setShow] = useState<ShowDetail | null>(null);
  const [status, setStatus] = useState<ShowStatus | null>(null);
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [watched, setWatched] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token || !tmdbId) return;
    const id = Number(tmdbId);
    Promise.all([
      api.getShow(id, token),
      api.getEpisode(id, sn, ep, token),
      api.getEpisodeCast(id, sn, ep, token),
      api.getShowSeasons(id, token),
      api.getEpisodeHistory(id, sn, ep, token),
    ])
      .then(([showData, episodeData, castData, seasonsData, historyData]) => {
        setShow(showData.show);
        setStatus(showData.status);
        setEpisode(episodeData.episode);
        setWatched(episodeData.watched);
        setCast(castData.cast);
        setSeasons(seasonsData.seasons);
        setHistory(historyData);
      })
      .catch(() => setError("Failed to load episode."));
  }, [isLoading, token, tmdbId, sn, ep]);

  useEffect(() => {
    if (show && episode) {
      document.title = `Trakt - ${show.title} S${String(sn).padStart(2, "0")}E${String(ep).padStart(2, "0")}`;
    }
  }, [show, episode, sn, ep]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey) return;
      if (e.key === "ArrowLeft") {
        navigatePrevious();
      } else if (e.key === "ArrowRight") {
        navigateNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [seasons, sn, ep, tmdbId]);

  function navigatePrevious() {
    if (!tmdbId || seasons.length === 0) return;

    const currentSeason = seasons.find(s => s.seasonNumber === sn);
    if (!currentSeason) return;

    if (ep > 1) {
      router.push(`/shows/${tmdbId}/seasons/${sn}/episodes/${ep - 1}`);
    } else if (sn > 1) {
      const prevSeason = seasons.find(s => s.seasonNumber === sn - 1);
      if (prevSeason) {
        router.push(`/shows/${tmdbId}/seasons/${sn - 1}/episodes/${prevSeason.episodeCount}`);
      }
    }
  }

  function navigateNext() {
    if (!tmdbId || seasons.length === 0) return;

    const currentSeason = seasons.find(s => s.seasonNumber === sn);
    if (!currentSeason) return;

    if (ep < currentSeason.episodeCount) {
      router.push(`/shows/${tmdbId}/seasons/${sn}/episodes/${ep + 1}`);
    } else if (sn < seasons[seasons.length - 1].seasonNumber) {
      router.push(`/shows/${tmdbId}/seasons/${sn + 1}/episodes/1`);
    }
  }

  async function handleMarkWatched(watchedAt: string) {
    if (!token) return;
    const res = await api.toggleEpisodeWatched(Number(tmdbId), sn, ep, false, token, watchedAt);
    setWatched(res.watched);
    api.getEpisodeHistory(Number(tmdbId), sn, ep, token).then((h) => setHistory(h)).catch(() => {});
  }

  async function handleRemoveLatest(id: number) {
    await api.deleteHistory(id, token!);
    const h = await api.getEpisodeHistory(Number(tmdbId), sn, ep, token!);
    setHistory(h);
    setWatched(h.length > 0);
  }

  async function handleRemoveAll() {
    const res = await api.toggleEpisodeWatched(Number(tmdbId), sn, ep, true, token!);
    setWatched(res.watched);
    setHistory([]);
  }

  async function handleRefreshEpisodeData() {
    if (!token) return;
    const result = await api.refreshSeasonEpisodes(Number(tmdbId), sn, token);
    const episodeData = result.episodes.find(e => e.episodeNumber === ep);
    if (episodeData) {
      setEpisode({
        id: episodeData.id,
        episodeNumber: episodeData.episodeNumber,
        title: episodeData.title,
        overview: episodeData.overview,
        airDate: episodeData.airDate,
        stillPath: episodeData.stillPath,
        runtimeMin: episodeData.runtimeMin,
        showTmdbId: Number(tmdbId),
        showTitle: show!.title,
        seasonNumber: sn,
      });
    }
  }

  async function handleRefreshCast() {
    if (!token) return;
    const castData = await api.getEpisodeCast(Number(tmdbId), sn, ep, token);
    setCast(castData.cast);
  }

  async function handleRefreshAll() {
    await handleRefreshEpisodeData();
    await handleRefreshCast();
  }

  if (error) return <p className="text-error">{error}</p>;
  if (!show || !status || !episode) return <p className="text-on-surface-variant">Loading…</p>;

  const backdropUrl = show.backdropPath ? `${TMDB_IMG}w1280${show.backdropPath}` : null;
  const posterUrl = show.posterPath ? `${TMDB_IMG}w342${show.posterPath}` : null;
  const stillUrl = episode.stillPath ? `${TMDB_IMG}w500${episode.stillPath}` : null;

  const guestStars = cast.filter(m => !m.isRegular);
  const regulars = cast.filter(m => m.isRegular);

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
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f]/25 via-[#0f0f0f]/5 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f]/25 via-transparent to-[#0f0f0f]/25" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />

          {/* Episode Navigation Buttons */}
          <button
            onClick={navigatePrevious}
            className="absolute left-20 top-1/2 -translate-y-1/2 z-20 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full p-2 transition-colors text-white/70 hover:text-white flex items-center justify-center"
            aria-label="Previous episode"
          >
            <span className="material-symbols-outlined text-3xl">chevron_left</span>
          </button>
          <button
            onClick={navigateNext}
            className="absolute right-20 top-1/2 -translate-y-1/2 z-20 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full p-2 transition-colors text-white/70 hover:text-white flex items-center justify-center"
            aria-label="Next episode"
          >
            <span className="material-symbols-outlined text-3xl">chevron_right</span>
          </button>

          <div className="absolute bottom-0 left-0 w-full z-10 pb-8 md:pb-12">
            <div className="max-w-page mx-auto px-margin-page flex items-end gap-6">
              {posterUrl && (
                <div className="hidden md:block shrink-0 w-32 lg:w-40 aspect-[2/3] overflow-hidden shadow-2xl border border-white/10 relative">
                  <Image src={posterUrl} alt={show.title} fill className="object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <Link href={`/shows/${tmdbId}/seasons/${sn}`} className="hover:opacity-80 transition-opacity">
                  <p className="text-white/60 text-lg font-semibold mb-1">Season {sn}</p>
                </Link>
                <Link href={`/shows/${tmdbId}`} className="hover:opacity-80 transition-opacity">
                  <h1 className="text-h1 font-black text-white drop-shadow-2xl">{show.title}</h1>
                </Link>
                <p className="text-white/60 text-lg font-semibold mt-1 mb-3">
                  S{String(sn).padStart(2, "0")} E{String(ep).padStart(2, "0")} · {episode.title ?? `Episode ${ep}`}
                </p>
                {episode.overview && (
                  <p className="text-body-sm text-white/70 line-clamp-3">{episode.overview}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-page mx-auto px-margin-page mt-12 grid grid-cols-1 lg:grid-cols-12 gap-stack-lg pb-16">
          <div className="lg:col-span-8 space-y-10">
            {/* Metadata */}
            {(episode.airDate || episode.runtimeMin) && (
              <section className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                {episode.airDate && (
                  <div>
                    <p className="text-on-surface/40 text-xs font-black uppercase tracking-widest mb-1">Air Date</p>
                    <p className="text-on-surface text-base">{formatDate(episode.airDate)}</p>
                  </div>
                )}
                {episode.runtimeMin && (
                  <div>
                    <p className="text-on-surface/40 text-xs font-black uppercase tracking-widest mb-1">Runtime</p>
                    <p className="text-on-surface text-base">{episode.runtimeMin} min</p>
                  </div>
                )}
              </section>
            )}

            {/* Episode Still */}
            {stillUrl && (
              <section className="relative aspect-video overflow-hidden bg-surface-container-high border border-outline-variant/30">
                <Image src={stillUrl} alt={episode.title ?? ""} fill className="object-cover" />
              </section>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <section>
                <div className="mb-6">
                  <h2 className="text-on-surface font-black text-xl">Cast</h2>
                </div>
                <div className="space-y-8">
                  {regulars.length > 0 && (
                    <div>
                      {guestStars.length > 0 && (
                        <p className="text-on-surface/40 text-xs font-black uppercase tracking-widest mb-4">Series Regulars</p>
                      )}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {regulars.map((member) => (
                          <CastCard key={`${member.tmdbId}-regular`} member={member} />
                        ))}
                      </div>
                    </div>
                  )}
                  {guestStars.length > 0 && (
                    <div>
                      {regulars.length > 0 && (
                        <p className="text-on-surface/40 text-xs font-black uppercase tracking-widest mb-4">Guest Stars</p>
                      )}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {guestStars.map((member) => (
                          <CastCard key={`${member.tmdbId}-guest`} member={member} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <div className="glass-panel rounded-3xl p-6 space-y-6 sticky top-24 overflow-visible">
              <div>
                <h3 className="text-on-surface font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-accent">person</span>
                  Personal Tracking
                </h3>
                <WatchDatePicker
                  watched={watched}
                  releaseDate={episode?.airDate ?? null}
                  onMark={handleMarkWatched}
                  onRemoveLatest={handleRemoveLatest}
                  onRemoveAll={handleRemoveAll}
                  latestEntryId={history[0]?.id ?? null}
                  releaseDateLabel="Air Date"
                />
              </div>

              {history.length > 0 && (
                <div className="border-t border-outline-variant/40 pt-4">
                  <label className="text-on-surface/40 text-[10px] font-black uppercase tracking-widest block mb-3">Watch History</label>
                  <div className="space-y-2">
                    {history.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-2 rounded bg-surface-container hover:bg-surface-container-high transition-colors">
                        <div className="flex-1">
                          <p className="text-on-surface text-sm">
                            {new Date(entry.watchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <p className="text-on-surface/50 text-xs capitalize">{entry.source}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveLatest(entry.id)}
                          className="text-on-surface/40 hover:text-accent transition-colors ml-2"
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-outline-variant/40 pt-4">
                <label className="text-on-surface/40 text-[10px] font-black uppercase tracking-widest block mb-3">Links</label>
                <div className="grid grid-cols-3 gap-2">
                  <Link
                    href={`https://www.themoviedb.org/tv/${tmdbId}/season/${sn}/episode/${ep}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-outline-variant/40 hover:border-accent/40 text-on-surface/60 hover:text-accent py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider text-center transition-all"
                  >
                    TMDB
                  </Link>
                  <Link
                    href={`https://trakt.tv/search?q=${encodeURIComponent(show?.title || '')}&type=show`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-outline-variant/40 hover:border-accent/40 text-on-surface/60 hover:text-accent py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider text-center transition-all"
                  >
                    Trakt
                  </Link>
                </div>
              </div>

              <div className="border-t border-outline-variant/40 pt-4">
                <RefreshButton sections={[
                  { label: "All Data", onRefresh: handleRefreshAll },
                  { label: "Episode Data", onRefresh: handleRefreshEpisodeData },
                  { label: "Cast", onRefresh: handleRefreshCast },
                ]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CastCard({ member }: { member: CastMember }) {
  const photoUrl = member.profilePath ? `${TMDB_IMG}w185${member.profilePath}` : null;
  return (
    <a
      href={`https://www.themoviedb.org/person/${member.tmdbId}-${member.name.toLowerCase().replace(/\s+/g, "-")}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-center group cursor-pointer"
    >
      <div className="relative aspect-[2/3] mb-2 overflow-hidden bg-surface-container-high rounded border border-outline-variant/30 group-hover:border-outline-variant transition-colors">
        {photoUrl ? (
          <Image src={photoUrl} alt={member.name} fill sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw" className="object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl text-on-surface/20">person</span>
          </div>
        )}
      </div>
      <p className="text-on-surface text-xs font-semibold line-clamp-2 group-hover:text-accent transition-colors">{member.name}</p>
      <p className="text-on-surface/50 text-[10px] line-clamp-2 mt-0.5">{member.character}</p>
    </a>
  );
}
