"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { StatsAllTime } from "@trakt/types";

export const dynamic = "force-dynamic";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

function fmtMinutes(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
}

export default function StatsPage() {
  const { token, isLoading } = useAuth();
  const [stats, setStats] = useState<StatsAllTime | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    api.getStatsAllTime(token)
      .then(setStats)
      .catch(() => setError("Failed to load stats."));
  }, [token, isLoading]);

  const currentYear = new Date().getFullYear();

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;
  if (!stats) return <p className="text-white/40">Loading…</p>;

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-h1 font-black tracking-tight text-white mb-1">Stats</h1>
            <p className="text-white/40">All-time watch statistics.</p>
          </div>
          <Link
            href={`/stats/year/${currentYear}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#181818] border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
          >
            {currentYear} Review
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </header>

        {/* Summary row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Time Watched", value: fmtMinutes(stats.totalMinutes), icon: "schedule" },
            { label: "Shows", value: stats.totalShows.toLocaleString(), icon: "tv" },
            { label: "Movies", value: stats.totalMovies.toLocaleString(), icon: "movie" },
            { label: "Episodes", value: stats.totalEpisodes.toLocaleString(), icon: "play_circle" },
          ].map((s) => (
            <div key={s.label} className="glass-panel rounded-xl p-5">
              <span className="material-symbols-outlined text-accent text-2xl mb-2 block">{s.icon}</span>
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Streak */}
        {stats.longestStreak > 0 && (
          <div className="glass-panel rounded-xl p-5 mb-8 flex items-center gap-4">
            <span className="material-symbols-outlined text-accent text-3xl">local_fire_department</span>
            <div>
              <p className="text-2xl font-black text-white">{stats.longestStreak} days</p>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Longest Watch Streak</p>
            </div>
          </div>
        )}

        {/* Top genres */}
        {stats.topGenres.length > 0 && (
          <div className="glass-panel rounded-xl p-5 mb-8">
            <h2 className="text-h3 font-bold text-white mb-4">Top Genres</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topGenres.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="genre" tick={{ fill: "#e2e2e2", fontSize: 12 }} width={100} />
                  <Tooltip
                    contentStyle={{ background: "#181818", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    labelStyle={{ color: "#e2e2e2" }}
                    itemStyle={{ color: "rgb(var(--accent-rgb))" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.topGenres.slice(0, 8).map((_entry, i) => (
                      <Cell key={i} fill={i === 0 ? "rgb(var(--accent-rgb))" : "rgb(var(--accent-rgb) / 0.4)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top shows */}
        {stats.topShows.length > 0 && (
          <div className="mb-8">
            <h2 className="text-h3 font-bold text-white mb-4">Most Watched Shows</h2>
            <div className="flex flex-col gap-2">
              {stats.topShows.slice(0, 5).map((show: { tmdbId: number; title: string; posterPath: string | null; episodeCount: number }, i: number) => {
                const posterUrl = show.posterPath ? `${TMDB_IMG}w92${show.posterPath}` : null;
                return (
                  <Link key={show.tmdbId} href={`/shows/${show.tmdbId}`}
                    className="glass-panel rounded-xl p-3 flex items-center gap-4 hover:border-accent/30 transition-all group"
                  >
                    <span className="text-2xl font-black text-white/20 w-8 text-center">{i + 1}</span>
                    <div className="relative w-10 h-14 rounded overflow-hidden bg-[#181818] flex-shrink-0">
                      {posterUrl && <Image src={posterUrl} alt={show.title} fill className="object-cover" />}
                    </div>
                    <div className="flex-grow">
                      <p className="font-bold text-white group-hover:text-accent transition-colors">{show.title}</p>
                      <p className="text-xs text-white/40">{show.episodeCount} episode{show.episodeCount !== 1 ? "s" : ""}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Heatmap */}
        {stats.heatmap.length > 0 && (
          <div className="glass-panel rounded-xl p-5">
            <h2 className="text-h3 font-bold text-white mb-4">Watch Activity</h2>
            <HeatMap data={stats.heatmap} />
          </div>
        )}

        {/* Year nav */}
        <div className="mt-8">
          <h2 className="text-h3 font-bold text-white mb-4">Year in Review</h2>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <Link
                key={y}
                href={`/stats/year/${y}`}
                className="px-4 py-2 rounded-lg bg-[#181818] border border-white/10 text-white/60 hover:text-white hover:border-accent/40 text-sm font-bold transition-colors"
              >
                {y}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeatMap({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const byDate = new Map(data.map((d) => [d.date, d.count]));

  const now = new Date();
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  start.setDate(start.getDate() - start.getDay());

  const weeks: { date: string; count: number }[][] = [];
  const cur = new Date(start);
  while (cur <= now) {
    const week: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().split("T")[0];
      week.push({ date: iso, count: byDate.get(iso) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => {
              const intensity = day.count > 0 ? Math.max(0.15, day.count / maxCount) : 0;
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.count} watch${day.count !== 1 ? "es" : ""}`}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    background: day.count > 0
                      ? `rgba(232, 0, 45, ${intensity})`
                      : "rgba(255,255,255,0.05)"
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}


