"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type MovieDetail, type MovieStatus, type MovieCastMember, type CrewMember } from "@/lib/api";
import { ImagePickerModal } from "@/components/image-picker-modal";
import { RefreshButton } from "@/components/refresh-button";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

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

export default function MovieDetailPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const { token, isLoading } = useAuth();
  const [movie, setMovie] = useState<(MovieDetail & { id: number }) | null>(null);
  const [status, setStatus] = useState<MovieStatus | null>(null);
  const [cast, setCast] = useState<MovieCastMember[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [tab, setTab] = useState<"cast" | "crew">("cast");
  const [castLoading, setCastLoading] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<"hero" | "poster" | null>(null);

  useEffect(() => {
    if (!tmdbId) return;
    const id = Number(tmdbId);

    if (isLoading || !token) {
      setCastLoading(true);
      return;
    }

    api.getMovie(id, token)
      .then((data) => {
        setMovie(data.movie);
        setStatus(data.status);

        setCastLoading(true);
        api.getMovieCast(id, token)
          .then((d) => setCast(d.cast))
          .catch(() => {})
          .finally(() => setCastLoading(false));
        api.getMovieCrew(id, token).then((d) => setCrew(d.crew)).catch(() => {});
      })
      .catch(() => setError("Failed to load movie."));
  }, [isLoading, token, tmdbId]);

  async function handleWatchlist() {
    const res = await api.toggleMovieWatchlist(Number(tmdbId), status!.inWatchlist, token!);
    setStatus((s) => s && { ...s, inWatchlist: res.inWatchlist });
  }

  async function handleCollection() {
    const res = await api.toggleMovieCollection(Number(tmdbId), status!.inCollection, token!);
    setStatus((s) => s && { ...s, inCollection: res.inCollection });
  }

  async function handleWatched() {
    const res = await api.toggleMovieWatched(Number(tmdbId), status!.watched, token!);
    setStatus((s) => s && { ...s, watched: res.watched });
  }

  async function handleRating(r: number) {
    if (!token) return;
    setRating(r);
    await api.upsertRating("movie", Number(tmdbId), r, token).catch(() => {});
  }

  function handleImageSaved(imageType: "hero" | "poster", path: string) {
    setMovie((m) => m
      ? { ...m, backdropPath: imageType === "hero" ? path : m.backdropPath, posterPath: imageType === "poster" ? path : m.posterPath }
      : null);
  }

  async function handleRefreshMovieMetadata() {
    if (!token) return;
    const result = await api.refreshMovieMetadata(Number(tmdbId), token);
    setMovie(result.movie);
  }

  async function handleRefreshMovieCast() {
    if (!token) return;
    const result = await api.refreshMovieCast(Number(tmdbId), token);
    setCast(result.cast);
    setCrew(result.crew);
  }

  async function handleRefreshAll() {
    await handleRefreshMovieMetadata();
    await handleRefreshMovieCast();
  }

  async function handleRefreshMovieCastOnly() {
    if (!token) return;
    const result = await api.refreshMovieCast(Number(tmdbId), token);
    setCast(result.cast);
  }

  if (error) return <p className="text-error">{error}</p>;

  const backdropUrl = movie?.backdropPath ? `${TMDB_IMG}w1280${movie.backdropPath}` : null;
  const displayedCast = tab === "cast" ? cast : crew;

  if (!movie || !status) {
    return (
      <div className="w-full flex-1 overflow-x-hidden">
        {castLoading && (cast.length === 0 && crew.length === 0) ? (
          <div className="max-w-page mx-auto px-margin-page mt-12 pb-16">
            <section>
              <div className="flex gap-6 border-b border-white/5 mb-6">
                <span className="text-white/40 text-sm">Loading cast…</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="text-center">
                    <div className="relative w-full aspect-[2/3] overflow-hidden bg-surface-container-high mb-2 border border-white/5 animate-pulse" />
                    <div className="h-3 bg-surface-container-high rounded mb-2 animate-pulse" />
                    <div className="h-2 bg-surface-container-high rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <p className="text-on-surface-variant">Loading…</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex-1 overflow-x-hidden">
      <div className="-mx-margin-page -mt-stack-lg">
        {/* Hero */}
        <section className="relative h-[450px] md:h-[576px] w-full overflow-hidden group/hero">
          {backdropUrl ? (
            <Image src={backdropUrl} alt={movie.title} fill priority className="object-cover object-top" />
          ) : (
            <div className="w-full h-full bg-surface-container-low" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-transparent to-[#0f0f0f]" />

          {/* Hero edit button */}
          <button
            onClick={() => setPicker("hero")}
            aria-label="Change backdrop image"
            className="absolute top-14 right-16 z-20 flex items-center gap-1.5 bg-black/60 border border-white/20 rounded-full px-3 py-2 text-white backdrop-blur-sm opacity-20 group-hover/hero:opacity-100 transition-opacity hover:border-[#e8002d]/60 hover:text-[#e8002d]"
          >
            <span className="material-symbols-outlined text-base leading-none" style={{ fontVariationSettings: "'FILL' 0" }}>edit</span>
            <span className="text-sm font-bold">Backdrop</span>
          </button>

          <div className="absolute bottom-0 left-0 w-full z-10 pb-8 md:pb-12">
            <div className="max-w-page mx-auto px-margin-page flex items-end gap-6">
              {movie.posterPath && (
                <div className="relative group/poster hidden md:block shrink-0 w-32 lg:w-40 aspect-[2/3] overflow-hidden shadow-2xl border border-white/10">
                  <Image src={`${TMDB_IMG}w342${movie.posterPath}`} alt={movie.title} fill className="object-cover" />
                  <EditImageButton onClick={() => setPicker("poster")} label="Change poster image" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  {movie.genres.slice(0, 2).map((g) => (
                    <span key={g} className="bg-white/10 backdrop-blur-md text-white/80 px-3 py-1 rounded-full text-label-sm font-bold uppercase border border-white/10">{g}</span>
                  ))}
                </div>
                <h1 className="text-h1 font-black text-white mb-3 drop-shadow-2xl">{movie.title}</h1>
                {movie.overview && (
                  <p className="text-body-sm text-white/70 line-clamp-3">{movie.overview}</p>
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
              {movie.releaseDate && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Premiered</p>
                  <p className="text-white text-base">{formatDate(movie.releaseDate)}</p>
                </div>
              )}
              {movie.runtimeMin && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Runtime</p>
                  <p className="text-white text-base">{movie.runtimeMin} min</p>
                </div>
              )}
              {movie.originCountry && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Country</p>
                  <p className="text-white text-base">{formatCountry(movie.originCountry)}</p>
                </div>
              )}
              {movie.originalLanguage && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Language</p>
                  <p className="text-white text-base">{formatLanguage(movie.originalLanguage)}</p>
                </div>
              )}
              {movie.productionCompany && (
                <div>
                  <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Studio</p>
                  <p className="text-white text-base">{movie.productionCompany}</p>
                </div>
              )}
            </section>

            {/* Cast/Crew Tabs */}
            {(cast.length > 0 || crew.length > 0 || castLoading) && (
              <section>
                <div className="flex gap-6 border-b border-white/5 mb-6 justify-between items-center">
                  <div className="flex gap-6">
                    {cast.length > 0 || crew.length > 0 ? (
                      (["cast", "crew"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTab(t)}
                          className={`pb-2 text-sm font-bold border-b-2 transition-colors ${
                            tab === t ? "text-white border-[#e8002d]" : "text-white/40 border-transparent hover:text-white"
                          }`}
                        >
                          {t === "cast" ? `Cast (${cast.length})` : `Crew (${crew.length})`}
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
                        <p className="text-white text-xs font-bold line-clamp-1 group-hover:text-[#e8002d] transition-colors">{m.name}</p>
                        {tab === "cast" ? (
                          <p className="text-white/40 text-sm line-clamp-1">{(m as MovieCastMember).character}</p>
                        ) : (
                          <>
                            <p className="text-white/40 text-xs line-clamp-1">{(m as CrewMember).job}</p>
                            <p className="text-white/30 text-xs">{(m as CrewMember).department}</p>
                          </>
                        )}
                      </a>
                    ))}
                  </div>
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

              <div className="space-y-2">
                {movie.rtCriticScore != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40 font-bold">IMDb</span>
                    <span className="text-white">{(movie.rtCriticScore / 10).toFixed(1)}/10</span>
                  </div>
                )}
                {movie.tmdbRating != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40 font-bold">TMDB</span>
                    <span className="text-white">{(movie.tmdbRating / 10).toFixed(1)}/10</span>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-4">
                <RefreshButton sections={[
                  { label: "All Data", onRefresh: handleRefreshAll },
                  { label: "Metadata", onRefresh: handleRefreshMovieMetadata },
                  { label: "Cast", onRefresh: handleRefreshMovieCastOnly },
                ]} />
              </div>

              <Link
                href={`https://www.themoviedb.org/movie/${tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full border border-white/10 hover:border-[#e8002d]/40 text-white/60 hover:text-[#e8002d] py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all"
              >
                View on TMDB
              </Link>
              {movie.imdbId && (
                <Link
                  href={`https://www.imdb.com/title/${movie.imdbId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full border border-white/10 hover:border-[#e8002d]/40 text-white/60 hover:text-[#e8002d] py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all"
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
          mediaType="movie"
          onSaved={(path) => handleImageSaved(picker, path)}
        />
      )}
    </div>
  );
}
