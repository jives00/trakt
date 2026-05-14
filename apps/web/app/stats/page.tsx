"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { api } from "@/lib/api";
import type { StatsAllTime } from "@trakt/types";

export const dynamic = "force-dynamic";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

function GenreTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-container border border-outline-variant/40 rounded px-2 py-1">
        <p className="text-sm text-accent">{(payload[0].value as number).toLocaleString()}</p>
      </div>
    );
  }
  return null;
}

function fmtMinutes(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
}

export default function StatsPage() {
  const { token, isLoading } = useAuth();
  const { theme } = useTheme();
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
  if (!stats) return <p className="text-on-surface/40">Loading…</p>;

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-h1 font-black tracking-tight text-on-surface mb-1">Stats</h1>
            <p className="text-on-surface-variant/70">All-time watch statistics.</p>
          </div>
          <Link
            href={`/stats/year/${currentYear}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface-variant hover:text-on-surface text-xs font-bold uppercase tracking-widest transition-colors"
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
              <p className="text-2xl font-black text-on-surface">{s.value}</p>
              <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-widest font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Streak */}
        {stats.longestStreak > 0 && (
          <div className="glass-panel rounded-xl p-5 mb-8 flex items-center gap-4">
            <span className="material-symbols-outlined text-accent text-3xl">local_fire_department</span>
            <div>
              <p className="text-2xl font-black text-on-surface">{stats.longestStreak} days</p>
              <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-widest font-bold">Longest Watch Streak</p>
            </div>
          </div>
        )}

        {/* Top genres */}
        {stats.topGenres.length > 0 && (
          <div className="glass-panel rounded-xl p-5 mb-8">
            <h2 className="text-h2 font-black tracking-tight text-on-surface mb-4">Top Genres</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topGenres.slice(0, 8)} layout="vertical" margin={{ left: 150, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="genre" tick={{ fill: "#cccccc", fontSize: 12 }} width={145} />
                  <Tooltip content={<GenreTooltip />} cursor={false} wrapperStyle={{ outline: "none" }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} shape={<CustomBarShape />} activeBar={false}>
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
            <h2 className="text-h2 font-black tracking-tight text-on-surface mb-4">Most Watched Shows</h2>
            <div className="flex flex-col gap-2">
              {stats.topShows.slice(0, 5).map((show: { tmdbId: number; title: string; posterPath: string | null; episodeCount: number }, i: number) => {
                const posterUrl = show.posterPath ? `${TMDB_IMG}w92${show.posterPath}` : null;
                return (
                  <Link key={show.tmdbId} href={`/shows/${show.tmdbId}`}
                    className="glass-panel rounded-xl p-3 flex items-center gap-4 hover:border-accent/30 transition-all group"
                  >
                    <span className="text-2xl font-black text-on-surface/20 w-8 text-center">{i + 1}</span>
                    <div className="relative w-10 h-14 rounded overflow-hidden bg-surface-container flex-shrink-0">
                      {posterUrl && <Image src={posterUrl} alt={show.title} fill className="object-cover" />}
                    </div>
                    <div className="flex-grow">
                      <p className="font-bold text-on-surface group-hover:text-accent transition-colors">{show.title}</p>
                      <p className="text-xs text-on-surface/40">{show.episodeCount} episode{show.episodeCount !== 1 ? "s" : ""}</p>
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
            <h2 className="text-h2 font-black tracking-tight text-on-surface mb-4">Watch Activity</h2>
            <HeatMap data={stats.heatmap} theme={theme} />
          </div>
        )}

        {/* Year nav */}
        <div className="mt-8">
          <h2 className="text-h2 font-black tracking-tight text-on-surface mb-4">Year in Review</h2>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <Link
                key={y}
                href={`/stats/year/${y}`}
                className="px-4 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-accent/40 text-sm font-bold transition-colors"
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

function CustomBarShape(props: any) {
  const { fill, x, y, width, height } = props;
  return (
    <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} ry={4} />
  );
}

function HeatMap({ data, theme }: { data: { date: string; count: number }[]; theme: string }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const byDate = new Map(data.map((d) => [d.date, d.count]));

  const themeColors: { [key: string]: { r: number; g: number; b: number } } = {
    "red-dark":  { r: 232, g: 0,  b: 45 },
    "blue-dark": { r: 0,   g: 102, b: 255 },
    "red-light":  { r: 232, g: 0,  b: 45 },
    "blue-light": { r: 0,   g: 82, b: 204 },
  };
  const color = themeColors[theme as keyof typeof themeColors] || themeColors["red-dark"];

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

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthLabels: { [key: number]: string } = {
    0: "Jan", 1: "Feb", 2: "Mar", 3: "Apr", 4: "May", 5: "Jun",
    6: "Jul", 7: "Aug", 8: "Sep", 9: "Oct", 10: "Nov", 11: "Dec"
  };

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <div className="w-12 flex flex-col">
          <div className="h-6 mb-1 flex-shrink-0" />
          <div className="flex flex-col gap-1">
            {dayLabels.map((day) => (
              <div key={day} className="h-5 flex items-center justify-end pr-1 text-[10px] text-on-surface/40 flex-shrink-0">
                {day}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="flex gap-1">
            {weeks.map((week, wi) => {
              const firstDate = new Date(week[0].date);
              const label = wi % 4 === 0 ? monthLabels[firstDate.getMonth()] : "";
              return (
                <div key={wi} className="flex flex-col flex-1">
                  <div className="h-6 flex items-end justify-center text-[10px] text-on-surface/40 mb-1 flex-shrink-0">
                    {label}
                  </div>
                  <div className="flex flex-col gap-1">
                    {week.map((day) => {
                      const intensity = day.count > 0 ? Math.max(0.15, day.count / maxCount) : 0;
                      return (
                        <div
                          key={day.date}
                          title={`${day.date}: ${day.count} watch${day.count !== 1 ? "es" : ""}`}
                          className="w-full h-5 rounded-sm flex-shrink-0"
                          style={{
                            background: day.count > 0
                              ? `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity})`
                              : "rgb(var(--on-surface-rgb) / 0.05)"
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


