"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api, type ShowDetail, type ShowStatus, type EpisodeItem } from "@/lib/api";
import { ActionButton } from "@/components/action-buttons";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

export default function ShowDetailPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const { token, isLoading } = useAuth();
  const [show, setShow] = useState<ShowDetail | null>(null);
  const [status, setStatus] = useState<ShowStatus | null>(null);
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<Record<number, { episodes: EpisodeItem[]; watchedIds: number[] }>>({});
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
      const watchedIds = res.watched
        ? [...cur.watchedIds, ep.id]
        : cur.watchedIds.filter((id) => id !== ep.id);
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

  if (error) return <p className="text-error">{error}</p>;
  if (!show || !status) return <p className="text-on-surface-variant">Loading…</p>;

  return (
    <div className="flex flex-col gap-stack-lg">
      {show.backdropPath && (
        <div className="relative -mx-margin-page h-64 overflow-hidden sm:h-96">
          <Image
            src={`${TMDB_IMG}w1280${show.backdropPath}`}
            alt={show.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
      )}

      <div className="flex gap-stack-md">
        {show.posterPath && (
          <div className="relative hidden h-64 w-44 shrink-0 overflow-hidden rounded-lg sm:block">
            <Image src={`${TMDB_IMG}w300${show.posterPath}`} alt={show.title} fill className="object-cover" />
          </div>
        )}
        <div className="flex flex-col gap-stack-sm">
          <h1 className="text-h1 font-black tracking-tight text-on-surface">{show.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-label-sm uppercase tracking-widest text-on-surface-variant">
            {show.year > 0 && <span>{show.year}</span>}
            {show.network && <span>{show.network}</span>}
            {show.status && <span>{show.status}</span>}
            {show.genres.map((g) => <span key={g}>{g}</span>)}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <ActionButton label="+ Watchlist" active={status.inWatchlist} activeLabel="In Watchlist" onClick={handleWatchlist} />
            <ActionButton label="+ Collection" active={status.inCollection} activeLabel="In Collection" onClick={handleCollection} />
          </div>
          {show.overview && <p className="max-w-prose text-body-md text-on-surface-variant">{show.overview}</p>}
        </div>
      </div>

      {show.seasonCount > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-h3 font-bold text-on-surface">Seasons</h2>
          {Array.from({ length: show.seasonCount }, (_, i) => i + 1).map((n) => (
            <SeasonRow
              key={n}
              seasonNumber={n}
              isOpen={openSeason === n}
              data={seasons[n] ?? null}
              onToggle={() => toggleSeason(n)}
              onEpisodeWatched={(ep) => handleEpisodeWatched(n, ep)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SeasonRow({
  seasonNumber, isOpen, data, onToggle, onEpisodeWatched,
}: {
  seasonNumber: number;
  isOpen: boolean;
  data: { episodes: EpisodeItem[]; watchedIds: number[] } | null;
  onToggle: () => void;
  onEpisodeWatched: (ep: EpisodeItem) => Promise<void>;
}) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-on-surface"
      >
        <span>Season {seasonNumber}</span>
        <span className="text-on-surface-variant">{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && data && (
        <ul className="divide-y divide-outline-variant border-t border-outline-variant">
          {data.episodes.map((ep) => {
            const watched = data.watchedIds.includes(ep.id);
            return (
              <li key={ep.id} className="flex items-center justify-between px-4 py-3">
                <span className={watched ? "text-on-surface-variant line-through" : "text-on-surface"}>
                  {ep.episodeNumber}. {ep.title ?? `Episode ${ep.episodeNumber}`}
                </span>
                <ActionButton
                  label="Watch"
                  active={watched}
                  activeLabel="Watched"
                  onClick={() => onEpisodeWatched(ep)}
                  variant={watched ? "secondary" : "primary"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
