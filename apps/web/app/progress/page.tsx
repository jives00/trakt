"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ProgressItem } from "@trakt/types";

export const dynamic = "force-dynamic";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

type FilterStatus = "all" | "airing" | "ended";

const STATUS_STYLES: Record<string, { text: string; border: string; bg: string }> = {
  "returning series": { text: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/20" },
  "in production":    { text: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/20" },
  "airing":           { text: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/20" },
  "on break":         { text: "text-blue-400",    border: "border-blue-500/30",    bg: "bg-blue-500/20"    },
  "ended":            { text: "text-orange-400",  border: "border-orange-500/30",  bg: "bg-orange-500/20"  },
  "canceled":         { text: "text-white/40",    border: "border-white/10",       bg: "bg-white/5"        },
};

function statusStyle(status: string | null | undefined) {
  if (!status) return STATUS_STYLES["ended"];
  return STATUS_STYLES[status.toLowerCase()] ?? STATUS_STYLES["ended"];
}

export default function ProgressPage() {
  const { token, isLoading } = useAuth();
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    setFetching(true);
    api.getProgress(token, filter)
      .then(setItems)
      .catch(() => setError("Failed to load progress."))
      .finally(() => setFetching(false));
  }, [token, isLoading, filter]);

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;

  const featured = items[0] ?? null;
  const rest = items.slice(1);

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-h1 font-black tracking-tight text-white mb-1">Watching Progress</h1>
            <p className="text-white/40">
              {items.length > 0 ? `${items.length} show${items.length === 1 ? "" : "s"} in progress` : "No shows in progress."}
            </p>
          </div>
          <div className="flex gap-2">
            {(["all", "airing", "ended"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                  filter === f ? "bg-[#e8002d] text-white" : "bg-[#181818] text-white/40 border border-white/10 hover:text-white"
                }`}
              >
                {f === "all" ? "All" : f === "airing" ? "Currently Airing" : "Ended"}
              </button>
            ))}
          </div>
        </header>

        {fetching && <p className="text-white/40">Loading…</p>}

        {!fetching && items.length === 0 && (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-5xl text-white/20 mb-4 block">trending_up</span>
            <p className="text-white/40">No in-progress shows.</p>
          </div>
        )}

        {!fetching && featured && (
          <>
            {/* Bento Layout: Featured + Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
              <FeaturedCard item={featured} />
              <QuickStatsPanel items={items} />
            </div>

            {/* Progress Grid */}
            {rest.length > 0 && (
              <div>
                <h3 className="text-h3 font-bold text-white mb-6">Currently Tracking</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                  {rest.map((item) => <ProgressCard key={item.showId} item={item} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FeaturedCard({ item }: { item: ProgressItem }) {
  const pct = item.totalEpisodes > 0 ? Math.round((item.watchedEpisodes / item.totalEpisodes) * 100) : 0;
  const backdropUrl = item.posterPath ? `${TMDB_IMG}w1280${item.posterPath}` : null;

  return (
    <div className="md:col-span-8 group relative overflow-hidden rounded-2xl glass-panel border border-white/10 h-[360px]">
      {backdropUrl && (
        <div className="absolute inset-0 z-0">
          <Image src={backdropUrl} alt={item.title} fill className="object-cover opacity-40 group-hover:scale-105 transition-transform duration-700" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/60 to-transparent" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 p-8 w-full z-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="bg-white/10 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest">
            {item.nextEpisode
              ? `S${String(item.nextEpisode.seasonNumber).padStart(2,"0")} · Ep ${item.nextEpisode.episodeNumber}`
              : "In Progress"
            }
          </span>
        </div>
        <h2 className="text-h2 font-black text-white mb-2 leading-none">{item.title}</h2>
        {item.nextEpisode?.title && (
          <p className="text-white/60 text-sm mb-6 line-clamp-1">Next: {item.nextEpisode.title}</p>
        )}
        <div className="flex items-center gap-6">
          <Link href={`/shows/${item.tmdbId}`}
            className="bg-[#e8002d] text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#e8002d]/20">
            <span className="material-symbols-outlined text-sm">play_arrow</span> Play Next
          </Link>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total Progress</span>
              <span className="text-[10px] font-bold text-[#e8002d]">{pct}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#e8002d] rounded-full"
                style={{ width: `${pct}%`, boxShadow: "0 0 12px rgba(232,0,45,0.6)" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStatsPanel({ items }: { items: ProgressItem[] }) {
  const returning = items.filter((i) => i.status?.toLowerCase().includes("returning") || i.status?.toLowerCase().includes("airing")).length;
  const nextAiring = items.find((i) => i.nextEpisode && i.status?.toLowerCase().includes("returning"));

  return (
    <div className="md:col-span-4 flex flex-col gap-6">
      <div className="glass-panel p-6 rounded-2xl flex-1 flex flex-col justify-center">
        <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">Currently Returning</span>
        <div className="text-4xl font-black text-white">{returning} <span className="text-2xl text-white/40">shows</span></div>
        <div className="flex items-center gap-2 mt-4 text-emerald-400 text-xs font-bold">
          <span className="material-symbols-outlined text-sm">trending_up</span> Active this season
        </div>
      </div>
      <div className="glass-panel p-6 rounded-2xl flex-1 border-l-4 border-[#e8002d]">
        <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2 block">Next Airing</span>
        {nextAiring ? (
          <>
            <div className="text-lg font-bold text-white mb-1 line-clamp-1">{nextAiring.title}</div>
            {nextAiring.nextEpisode && (
              <div className="text-sm text-white/60">
                S{String(nextAiring.nextEpisode.seasonNumber).padStart(2,"0")}E{String(nextAiring.nextEpisode.episodeNumber).padStart(2,"0")}
                {nextAiring.nextEpisode.title ? ` · ${nextAiring.nextEpisode.title}` : ""}
              </div>
            )}
          </>
        ) : (
          <div className="text-white/40 text-sm">No upcoming episodes</div>
        )}
      </div>
    </div>
  );
}

function ProgressCard({ item }: { item: ProgressItem }) {
  const pct = item.totalEpisodes > 0 ? Math.round((item.watchedEpisodes / item.totalEpisodes) * 100) : 0;
  const posterUrl = item.posterPath ? `${TMDB_IMG}w300${item.posterPath}` : null;
  const st = statusStyle(item.status);

  return (
    <Link href={`/shows/${item.tmdbId}`} className="glass-panel rounded-2xl overflow-hidden group hover:-translate-y-1 transition-all duration-300 block">
      <div className="relative h-48">
        {posterUrl ? (
          <Image src={posterUrl} alt={item.title} fill className="object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-white/20">tv</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent" />
        {item.status && (
          <div className="absolute top-4 left-4">
            <span className={`backdrop-blur-md px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter border ${st.text} ${st.border} ${st.bg}`}>
              {item.status}
            </span>
          </div>
        )}
      </div>
      <div className="p-5">
        <h4 className="font-bold text-white text-base leading-tight mb-1 line-clamp-1">{item.title}</h4>
        {item.nextEpisode && (
          <p className="text-white/40 text-xs font-medium mb-4 line-clamp-1">
            Next: S{String(item.nextEpisode.seasonNumber).padStart(2,"0")}E{String(item.nextEpisode.episodeNumber).padStart(2,"0")}
            {item.nextEpisode.title ? ` · ${item.nextEpisode.title}` : ""}
          </p>
        )}
        <div className="flex justify-between items-center text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2">
          <span>{item.watchedEpisodes} / {item.totalEpisodes} eps</span>
          <span className="text-[#e8002d]">{pct}%</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#e8002d] rounded-full"
            style={{ width: `${pct}%`, boxShadow: "0 0 8px #e8002d" }}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <span className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 py-2 rounded-lg text-xs font-bold transition-all text-center text-white/80">Details</span>
        </div>
      </div>
    </Link>
  );
}
