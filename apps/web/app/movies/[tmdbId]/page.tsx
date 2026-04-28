"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api, type MovieStatus } from "@/lib/api";
import { ActionButton } from "@/components/action-buttons";
import type { Movie } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

export default function MovieDetailPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const { token, isLoading } = useAuth();
  const [movie, setMovie] = useState<(Movie & { id: number }) | null>(null);
  const [status, setStatus] = useState<MovieStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token || !tmdbId) return;
    api.getMovie(Number(tmdbId), token)
      .then((data) => { setMovie(data.movie); setStatus(data.status); })
      .catch(() => setError("Failed to load movie."));
  }, [isLoading, token, tmdbId]);

  if (error) return <p className="text-error">{error}</p>;
  if (!movie || !status) return <p className="text-on-surface-variant">Loading…</p>;

  async function handleWatched() {
    const res = await api.toggleMovieWatched(movie!.tmdbId, status!.watched, token!);
    setStatus((s) => s && { ...s, watched: res.watched });
  }
  async function handleWatchlist() {
    const res = await api.toggleMovieWatchlist(movie!.tmdbId, status!.inWatchlist, token!);
    setStatus((s) => s && { ...s, inWatchlist: res.inWatchlist });
  }
  async function handleCollection() {
    const res = await api.toggleMovieCollection(movie!.tmdbId, status!.inCollection, token!);
    setStatus((s) => s && { ...s, inCollection: res.inCollection });
  }

  return (
    <div className="flex flex-col gap-stack-lg">
      {movie.backdropPath && (
        <div className="relative -mx-margin-page h-64 overflow-hidden sm:h-96">
          <Image
            src={`${TMDB_IMG}w1280${movie.backdropPath}`}
            alt={movie.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
      )}

      <div className="flex gap-stack-md">
        {movie.posterPath && (
          <div className="relative hidden h-64 w-44 shrink-0 overflow-hidden rounded-lg sm:block">
            <Image
              src={`${TMDB_IMG}w300${movie.posterPath}`}
              alt={movie.title}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="flex flex-col gap-stack-sm">
          <h1 className="text-h1 font-black tracking-tight text-on-surface">{movie.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-label-sm uppercase tracking-widest text-on-surface-variant">
            {movie.year > 0 && <span>{movie.year}</span>}
            {movie.runtimeMin && <span>{movie.runtimeMin} min</span>}
            {movie.genres.map((g) => <span key={g}>{g}</span>)}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <ActionButton
              label="Mark Watched"
              active={status.watched}
              activeLabel="Watched ✓"
              onClick={handleWatched}
              variant="primary"
            />
            <ActionButton
              label="+ Watchlist"
              active={status.inWatchlist}
              activeLabel="In Watchlist"
              onClick={handleWatchlist}
            />
            <ActionButton
              label="+ Collection"
              active={status.inCollection}
              activeLabel="In Collection"
              onClick={handleCollection}
            />
          </div>
          {movie.overview && (
            <p className="max-w-prose text-body-md text-on-surface-variant">{movie.overview}</p>
          )}
        </div>
      </div>
    </div>
  );
}
