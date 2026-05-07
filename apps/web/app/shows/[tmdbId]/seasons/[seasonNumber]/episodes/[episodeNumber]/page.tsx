"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type ShowDetail, type ShowStatus, type EpisodeDetail, type CastMember } from "@/lib/api";
import { RefreshButton } from "@/components/refresh-button";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

function formatDate(date: string | null): string | null {
  if (!date) return null;
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function EpisodeDetailPage() {
  const { tmdbId, seasonNumber: snStr, episodeNumber: epStr } = useParams<{ tmdbId: string; seasonNumber: string; episodeNumber: string }>();
  const sn = Number(snStr);
  const ep = Number(epStr);
  const { token, isLoading } = useAuth();
  const [show, setShow] = useState<ShowDetail | null>(null);
  const [status, setStatus] = useState<ShowStatus | null>(null);
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [watched, setWatched] = useState(false);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token || !tmdbId) return;
    const id = Number(tmdbId);
    Promise.all([
      api.getShow(id, token),
      api.getEpisode(id, sn, ep, token),
      api.getEpisodeCast(id, sn, ep, token),
    ])
      .then(([showData, episodeData, castData]) => {
        setShow(showData.show);
        setStatus(showData.status);
        setEpisode(episodeData.episode);
        setWatched(episodeData.watched);
        setCast(castData.cast);
      })
      .catch(() => setError("Failed to load episode."));
  }, [isLoading, token, tmdbId, sn, ep]);

  async function handleWatched() {
    if (!token) return;
    const res = await api.toggleEpisodeWatched(Number(tmdbId), sn, ep, watched, token);
    setWatched(res.watched);
  }

  async function handleRefreshEpisodeData() {
    if (!token) return;
    const result = await api.refreshSeasonEpisodes(Number(tmdbId), sn, token);
    const episodeData = result.episodes.find(e => e.episodeNumber === ep);
    if (episodeData) {
      setEpisode({
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
            {/* Episode Still */}
            {stillUrl && (
              <section className="relative aspect-video overflow-hidden bg-surface-container-high border border-white/5">
                <Image src={stillUrl} alt={episode.title ?? ""} fill className="object-cover" />
              </section>
            )}

            {/* Metadata */}
            {(episode.airDate || episode.runtimeMin) && (
              <section className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                {episode.airDate && (
                  <div>
                    <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Air Date</p>
                    <p className="text-white text-base">{formatDate(episode.airDate)}</p>
                  </div>
                )}
                {episode.runtimeMin && (
                  <div>
                    <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Runtime</p>
                    <p className="text-white text-base">{episode.runtimeMin} min</p>
                  </div>
                )}
              </section>
            )}

            {/* Overview */}
            {episode.overview && (
              <section>
                <p className="text-white text-base leading-relaxed">{episode.overview}</p>
              </section>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <section>
                <div className="mb-6">
                  <h2 className="text-white font-black text-xl">Cast</h2>
                </div>
                <div className="space-y-8">
                  {regulars.length > 0 && (
                    <div>
                      {guestStars.length > 0 && (
                        <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-4">Series Regulars</p>
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
                        <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-4">Guest Stars</p>
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
            <div className="glass-panel rounded-3xl p-6 space-y-6 sticky top-24">
              <div>
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#e8002d]">person</span>
                  Personal Tracking
                </h3>
                <button
                  onClick={handleWatched}
                  className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                    watched
                      ? "bg-[#e8002d] text-white"
                      : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: watched ? "'FILL' 1" : "'FILL' 0" }}>check_circle</span>
                  {watched ? "Watched" : "Mark Watched"}
                </button>
              </div>

              <Link
                href={`https://www.themoviedb.org/tv/${tmdbId}/season/${sn}/episode/${ep}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full border border-white/10 hover:border-[#e8002d]/40 text-white/60 hover:text-[#e8002d] py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all"
              >
                View on TMDB
              </Link>

              <div className="border-t border-white/10 pt-4">
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
      <div className="relative aspect-[2/3] mb-2 overflow-hidden bg-surface-container-high rounded border border-white/5 group-hover:border-white/20 transition-colors">
        {photoUrl ? (
          <Image src={photoUrl} alt={member.name} fill sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw" className="object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl text-white/20">person</span>
          </div>
        )}
      </div>
      <p className="text-white text-xs font-semibold line-clamp-2 group-hover:text-[#e8002d] transition-colors">{member.name}</p>
      <p className="text-white/50 text-[10px] line-clamp-2 mt-0.5">{member.character}</p>
    </a>
  );
}
