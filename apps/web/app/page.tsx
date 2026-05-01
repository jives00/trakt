"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { UpNextItem, ScheduleItem, DashboardDailyStats, RecentItem, StatsAllTime } from "@trakt/types";
import { UpNextSection } from "@/components/up-next-section";
import { ScheduleSection } from "@/components/schedule-section";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

function usernameFromToken(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.username ?? payload.sub ?? "there";
  } catch { return "there"; }
}

export default function DashboardPage() {
  const { token, isLoading } = useAuth();
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [dailyStats, setDailyStats] = useState<DashboardDailyStats[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [alltime, setAlltime] = useState<StatsAllTime | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    Promise.all([
      api.getUpNext(token),
      api.getSchedule(token),
      api.getDashboardStats(token),
      api.getRecentItems(token, 6),
      api.getStatsAllTime(token),
    ])
      .then(([up, sched, stats, recent, at]) => {
        setUpNext(up); setSchedule(sched); setDailyStats(stats);
        setRecentItems(recent); setAlltime(at);
      })
      .catch(() => setFetchError("Failed to load dashboard."))
      .finally(() => setFetching(false));
  }, [token, isLoading]);

  if (isLoading || fetching) return null;
  if (fetchError) return <p className="text-error">{fetchError}</p>;

  const username = token ? usernameFromToken(token) : "there";

  return (
    <div className="flex flex-col gap-stack-lg">
      <HeroSection username={username} alltime={alltime} />
      <UpNextSection items={upNext} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <div className="lg:col-span-2">
          <ScheduleSection entries={schedule} />
        </div>
        <StatsBarChart data={dailyStats} />
      </div>
      <RecentSection items={recentItems} />
      <RecommendationsSection />
    </div>
  );
}

function HeroSection({ username, alltime }: { username: string; alltime: StatsAllTime | null }) {
  const daysWatched = alltime ? Math.round(alltime.totalMinutes / 1440) : 0;
  return (
    <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-8 md:p-12">
      <div className="absolute inset-0 bg-gradient-to-r from-surface-container-lowest via-transparent to-transparent z-0" />
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-8">
        <div>
          <h1 className="text-h1 font-black tracking-tight text-white mb-4 capitalize">Hello, {username}</h1>
          {alltime && (
            <div className="flex gap-8 md:gap-12">
              <Stat label="Shows Collected" value={alltime.totalShows.toLocaleString()} />
              <Stat label="Episodes Watched" value={alltime.totalEpisodes.toLocaleString()} />
              <Stat label="Days Watched" value={daysWatched.toLocaleString()} />
            </div>
          )}
        </div>
        {/* Now Playing card — renders only when scrobble is active (Phase 2+) */}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">{label}</p>
      <p className="text-h2 font-black text-white">{value}</p>
    </div>
  );
}

function RecentSection({ items }: { items: RecentItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>Recently Watched</SectionHeading>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {items.slice(0, 6).map((item) => <RecentCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

function RecentCard({ item }: { item: RecentItem }) {
  const isEpisode = item.mediaType === "episode";
  const href = item.tmdbId ? (isEpisode ? `/shows/${item.tmdbId}` : `/movies/${item.tmdbId}`) : "#";
  const posterUrl = item.posterPath ? `${TMDB_IMG}w500${item.posterPath}` : null;
  const title = isEpisode ? (item.showTitle ?? item.title) : item.title;

  return (
    <Link href={href} className="group relative aspect-video rounded-xl overflow-hidden border border-white/5 cursor-pointer block">
      {posterUrl ? (
        <Image src={posterUrl} alt={title ?? ""} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover object-center transition-transform duration-500 group-hover:scale-110" />
      ) : (
        <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-white/20">{isEpisode ? "tv" : "movie"}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-5">
        {isEpisode && item.seasonNumber != null && item.episodeNumber != null && (
          <p className="text-[#e8002d] text-[10px] font-black uppercase tracking-widest mb-1">
            S{String(item.seasonNumber).padStart(2, "0")} E{String(item.episodeNumber).padStart(2, "0")}
          </p>
        )}
        <h3 className="text-white font-bold text-lg">{title}</h3>
        {isEpisode && item.title && item.showTitle && (
          <p className="text-white/50 text-sm">{item.title}</p>
        )}
      </div>
    </Link>
  );
}

function RecommendationsSection() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
      <RecPanel title="Show Recommendations" />
      <RecPanel title="Movie Recommendations" />
    </section>
  );
}

function RecPanel({ title }: { title: string }) {
  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="p-6 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-h3 font-bold text-white">{title}</h3>
        <Link href="/search" className="text-[#e8002d] text-xs font-bold uppercase hover:underline">Browse</Link>
      </div>
      <div className="flex items-center justify-center h-32 text-white/20 text-sm">
        Recommendations coming soon
      </div>
    </div>
  );
}

function StatsBarChart({ data }: { data: DashboardDailyStats[] }) {
  if (data.length === 0) return null;
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    hours: Math.round(d.hours * 10) / 10,
  }));

  const topGenres = [
    { label: "Top Genre", pct: 0 },
  ];

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>Last 30 Days</SectionHeading>
      <div className="glass-panel p-5 rounded-xl flex-1">
        <div className="h-32 mb-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} interval={Math.floor(chartData.length / 4)} />
              <Tooltip
                contentStyle={{ background: "#181818", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                formatter={(v) => [`${typeof v === "number" ? v : 0}h`, "Hours"]}
              />
              <Bar dataKey="hours" fill="#e8002d" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {topGenres.map((g) => (
          <div key={g.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-white/40">Genres</span>
              <span className="text-white font-bold">—</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-h2 font-black tracking-tight text-on-surface">
      <span className="block h-8 w-1 rounded-full bg-primary-container" />
      {children}
    </h2>
  );
}
