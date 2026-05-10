"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { StatsYear } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMinutes(m: number) {
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h` : `${m}m`;
}

export default function StatsYearPage() {
  const { year: yearStr } = useParams<{ year: string }>();
  const year = Number(yearStr);
  const { token, isLoading } = useAuth();
  const [stats, setStats] = useState<StatsYear | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    api.getStatsYear(year, token)
      .then(setStats)
      .catch(() => setError("Failed to load stats."));
  }, [token, isLoading, year]);

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;
  if (!stats) return <p className="text-white/40">Loading…</p>;

  const chartData = stats.monthlyBreakdown.map((m) => ({
    month: MONTHS[m.month - 1],
    hours: Math.round(m.hours),
  }));

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <Link href="/stats" className="flex items-center gap-1 text-xs text-white/40 hover:text-white mb-3 transition-colors">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              All Stats
            </Link>
            <h1 className="text-h1 font-black tracking-tight text-white mb-1">{year} in Review</h1>
            <p className="text-white/40">Your year in watching.</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/stats/year/${year - 1}`} className="p-2 rounded-lg bg-[#181818] border border-white/10 text-white/40 hover:text-white transition-colors">
              <span className="material-symbols-outlined">chevron_left</span>
            </Link>
            <Link href={`/stats/year/${year + 1}`} className="p-2 rounded-lg bg-[#181818] border border-white/10 text-white/40 hover:text-white transition-colors">
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
        </header>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Hours Watched", value: `${Math.round(stats.totalMinutes / 60)}h` },
            { label: "Episodes", value: stats.totalEpisodes.toLocaleString() },
            { label: "Movies", value: stats.totalMovies.toLocaleString() },
            { label: "New Shows", value: stats.newShowsStarted.toLocaleString() },
            { label: "Completed", value: stats.showsCompleted.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="glass-panel rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Monthly bar chart */}
        {chartData.length > 0 && (
          <div className="glass-panel rounded-xl p-5 mb-8">
            <h2 className="text-h3 font-bold text-white mb-4">Hours per Month</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: 0, right: 8, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fill: "#e2e2e2", fontSize: 11 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#181818", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    labelStyle={{ color: "#e2e2e2" }}
                    formatter={(v) => [`${typeof v === "number" ? v : 0}h`, "Hours"]}
                  />
                  <Bar dataKey="hours" fill="rgb(var(--accent-rgb))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top shows */}
        {stats.topShows.length > 0 && (
          <div className="mb-8">
            <h2 className="text-h3 font-bold text-white mb-4">Top Shows</h2>
            <div className="flex flex-col gap-2">
              {stats.topShows.slice(0, 5).map((show, i) => {
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
                      <p className="text-xs text-white/40">{show.episodeCount} episodes</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Top genres */}
        {stats.topGenres.length > 0 && (
          <div>
            <h2 className="text-h3 font-bold text-white mb-4">Top Genres</h2>
            <div className="flex flex-wrap gap-2">
              {stats.topGenres.slice(0, 8).map((g) => (
                <div key={g.genre} className="glass-panel rounded-full px-4 py-2 flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{g.genre}</span>
                  <span className="text-xs text-white/40">{g.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Month nav */}
        <div className="mt-8">
          <h2 className="text-h3 font-bold text-white mb-4">Month by Month</h2>
          <div className="flex flex-wrap gap-2">
            {MONTHS.map((m, i) => (
              <Link
                key={m}
                href={`/stats/month/${year}/${i + 1}`}
                className="px-4 py-2 rounded-lg bg-[#181818] border border-white/10 text-white/60 hover:text-white hover:border-accent/40 text-sm font-bold transition-colors"
              >
                {m}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
