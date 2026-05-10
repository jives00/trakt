"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { StatsMonth } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/";
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function StatsMonthPage() {
  const { year: yearStr, month: monthStr } = useParams<{ year: string; month: string }>();
  const year = Number(yearStr);
  const month = Number(monthStr);
  const { token, isLoading } = useAuth();
  const [stats, setStats] = useState<StatsMonth | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    api.getStatsMonth(year, month, token)
      .then(setStats)
      .catch(() => setError("Failed to load stats."));
  }, [token, isLoading, year, month]);

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;
  if (!stats) return <p className="text-white/40">Loading…</p>;

  const chartData = stats.dailyBreakdown.map((d) => ({
    day: d.day,
    hours: Math.round(d.hours * 10) / 10,
  }));

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <Link href={`/stats/year/${year}`} className="flex items-center gap-1 text-xs text-white/40 hover:text-white mb-3 transition-colors">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              {year} in Review
            </Link>
            <h1 className="text-h1 font-black tracking-tight text-white mb-1">
              {MONTH_NAMES[month - 1]} {year}
            </h1>
            <p className="text-white/40">Monthly watch breakdown.</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/stats/month/${prevMonth.y}/${prevMonth.m}`} className="p-2 rounded-lg bg-[#181818] border border-white/10 text-white/40 hover:text-white transition-colors">
              <span className="material-symbols-outlined">chevron_left</span>
            </Link>
            <Link href={`/stats/month/${nextMonth.y}/${nextMonth.m}`} className="p-2 rounded-lg bg-[#181818] border border-white/10 text-white/40 hover:text-white transition-colors">
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
        </header>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Hours", value: `${Math.round(stats.totalMinutes / 60)}h` },
            { label: "Episodes", value: stats.totalEpisodes.toLocaleString() },
            { label: "Movies", value: stats.totalMovies.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="glass-panel rounded-xl p-5 text-center">
              <p className="text-3xl font-black text-white">{s.value}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Daily bar chart */}
        {chartData.length > 0 && (
          <div className="glass-panel rounded-xl p-5 mb-8">
            <h2 className="text-h3 font-bold text-white mb-4">Hours per Day</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
                  <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
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

        {/* Shows watched */}
        {stats.shows.length > 0 && (
          <div className="mb-8">
            <h2 className="text-h3 font-bold text-white mb-4">Shows Watched</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {stats.shows.map((show) => {
                const posterUrl = show.posterPath ? `${TMDB_IMG}w185${show.posterPath}` : null;
                return (
                  <Link key={show.tmdbId} href={`/shows/${show.tmdbId}`} className="group">
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#181818] mb-1">
                      {posterUrl && <Image src={posterUrl} alt={show.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />}
                    </div>
                    <p className="text-xs font-semibold text-white/60 line-clamp-1 group-hover:text-white transition-colors">{show.title}</p>
                    <p className="text-[10px] text-white/40">{show.episodeCount} ep</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Movies watched */}
        {stats.movies.length > 0 && (
          <div>
            <h2 className="text-h3 font-bold text-white mb-4">Movies Watched</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {stats.movies.map((movie) => {
                const posterUrl = movie.posterPath ? `${TMDB_IMG}w185${movie.posterPath}` : null;
                return (
                  <Link key={movie.tmdbId} href={`/movies/${movie.tmdbId}`} className="group">
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#181818] mb-1">
                      {posterUrl && <Image src={posterUrl} alt={movie.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />}
                    </div>
                    <p className="text-xs font-semibold text-white/60 line-clamp-1 group-hover:text-white transition-colors">{movie.title}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
