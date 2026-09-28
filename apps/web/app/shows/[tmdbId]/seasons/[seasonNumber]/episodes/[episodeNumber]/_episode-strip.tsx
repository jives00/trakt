import Link from "next/link";
import type { EpisodeItem } from "@/lib/api";

interface Props {
  tmdbId: string;
  seasonNumber: number;
  current: number;
  episodes: EpisodeItem[];
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function EpisodeStrip({ tmdbId, seasonNumber, current, episodes }: Props) {
  if (episodes.length === 0) return null;
  const today = localToday();
  const base = "min-w-8 h-8 px-2 flex items-center justify-center rounded text-sm font-bold";

  return (
    <nav aria-label={`Season ${seasonNumber} episodes`} className="flex flex-wrap gap-1.5">
      {episodes.map((e) => {
        const n = e.episodeNumber;
        if (n === current) {
          return <span key={n} aria-current="page" className={`${base} bg-accent text-white`}>{n}</span>;
        }
        if (!e.airDate || e.airDate > today) {
          return <span key={n} className={`${base} text-on-surface/25`}>{n}</span>;
        }
        return (
          <Link
            key={n}
            href={`/shows/${tmdbId}/seasons/${seasonNumber}/episodes/${n}`}
            className={`${base} text-on-surface/70 hover:text-accent hover:bg-surface-container-high transition-colors`}
          >
            {n}
          </Link>
        );
      })}
    </nav>
  );
}
