"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { UpNextItem, ScheduleItem, DashboardStats, DashboardDailyStats, DashboardSummary, DashboardGenre, RecentItem, StatsAllTime, UserProfile } from "@trakt/types";
import { UpNextSection } from "@/components/up-next-section";
import { ScheduleSection } from "@/components/schedule-section";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

export default function DashboardPage() {
  const { token, isLoading } = useAuth();
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [alltime, setAlltime] = useState<StatsAllTime | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    Promise.all([
      api.getProfile(token),
      api.getUpNext(token),
      api.getSchedule(token, 30),
      api.getDashboardStats(token),
      api.getRecentItems(token, 6),
      api.getStatsAllTime(token),
    ])
      .then(([prof, up, sched, stats, recent, at]) => {
        setProfile(prof); setUpNext(up); setSchedule(sched); setDashStats(stats);
        setRecentItems(recent); setAlltime(at);
      })
      .catch(() => setFetchError("Failed to load dashboard."))
      .finally(() => setFetching(false));
  }, [token, isLoading]);

  if (isLoading || fetching) return null;
  if (fetchError) return <p className="text-error">{fetchError}</p>;

  const greeting = profile?.displayName || profile?.username || "there";

  return (
    <div className="flex flex-col flex-1">
      <HeroSection username={greeting} alltime={alltime} />
      <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full flex flex-col gap-stack-lg">
        <UpNextSection items={upNext} />
        <ScheduleSection entries={schedule} />
        {dashStats && <StatsBarChart data={dashStats.daily} summary={dashStats.summary} genres={dashStats.genres} />}
        <RecentSection items={recentItems} />
        <RecommendationsSection />
      </div>
    </div>
  );
}

function HeroSection({ username, alltime }: { username: string; alltime: StatsAllTime | null }) {
  const daysWatched = alltime ? Math.round(alltime.totalMinutes / 1440) : 0;
  return (
    <section className="relative overflow-hidden bg-surface-container-low">
      <div className="px-margin-page py-12 md:py-16">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url('/trakt-pattern.jpg')`,
            backgroundRepeat: 'repeat',
            backgroundSize: 'auto',
            backgroundAttachment: 'fixed',
            filter: 'blur(3px) brightness(0.6)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-container-lowest/90 via-surface-container-lowest/70 to-transparent z-0" />
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

function formatWatchTime(totalMinutes: number): string {
  const d = Math.floor(totalMinutes / 1440);
  const h = Math.floor((totalMinutes % 1440) / 60);
  const m = Math.round(totalMinutes % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

const GENRE_COLORS = ["#c0392b","#16a085","#e67e22","#7f5539","#f1c40f","#8e44ad","#2980b9","#c0392b"];

function StatsBarChart({ data, summary, genres }: { data: DashboardDailyStats[]; summary: DashboardSummary; genres: DashboardGenre[] }) {
  const [activeBar, setActiveBar] = useState<number | null>(null);
  // Anchor to today in US Central time, then build a dense 30-day window
  const centralToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
  }).format(new Date()); // "en-CA" → YYYY-MM-DD
  const [y, m, d] = centralToday.split("-").map(Number);
  const anchor = Date.UTC(y, m - 1, d);

  const dataMap = new Map(data.map((item) => [item.date.slice(0, 10), item]));

  const chartData = Array.from({ length: 30 }, (_, i) => {
    const ms = anchor - (29 - i) * 86_400_000;
    const dt = new Date(ms);
    const dateStr = dt.toISOString().slice(0, 10);
    const entry = dataMap.get(dateStr);
    const totalMinutes = entry ? entry.hours * 60 : 0;
    return {
      date: String(dt.getUTCDate()),
      hours: Math.round((entry?.hours ?? 0) * 10) / 10,
      totalMinutes,
      episodes: entry?.episodes ?? 0,
      movies: entry?.movies ?? 0,
    };
  });

  const watchTime = formatWatchTime(summary.totalMinutes);
  const summaryParts: string[] = [`${watchTime} watched`];
  if (summary.episodes > 0) {
    summaryParts.push(`${summary.episodes} episode${summary.episodes !== 1 ? "s" : ""} (${summary.plays} play${summary.plays !== 1 ? "s" : ""})`);
  }
  if (summary.movies > 0) {
    summaryParts.push(`${summary.movies} movie${summary.movies !== 1 ? "s" : ""}`);
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <SectionHeading>Last 30 Days</SectionHeading>
        {summary.plays > 0 && (
          <p className="text-sm text-white/40 mt-1 ml-4">{summaryParts.join(" — ")}</p>
        )}
      </div>
      <div className="glass-panel p-5 rounded-xl flex-1">
        <div className="h-48 mb-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} interval={0} />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as typeof chartData[0];
                  const h = Math.floor(p.totalMinutes / 60);
                  const m = Math.round(p.totalMinutes % 60);
                  const time = [h > 0 && `${h}h`, m > 0 && `${m}m`].filter(Boolean).join(" ") || "0m";
                  return (
                    <div style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: "1.6" }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{time} watched</div>
                      {p.episodes > 0 && <div style={{ color: "rgba(255,255,255,0.55)" }}>{p.episodes} episode{p.episodes !== 1 ? "s" : ""}</div>}
                      {p.movies > 0 && <div style={{ color: "rgba(255,255,255,0.55)" }}>{p.movies} movie{p.movies !== 1 ? "s" : ""}</div>}
                    </div>
                  );
                }}
              />
              <Bar dataKey="hours" radius={[3, 3, 0, 0]} onMouseLeave={() => setActiveBar(null)}>
                {chartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={activeBar === i ? "#e8002d" : "rgba(255,255,255,0.2)"}
                    onMouseEnter={() => setActiveBar(i)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {genres.length > 0 && <GenreBar genres={genres} />}
      </div>
    </section>
  );
}

function GenreBar({ genres }: { genres: DashboardGenre[] }) {
  const total = genres.reduce((sum, g) => sum + g.plays, 0);
  return (
    <div className="mt-2">
      {/* Labels row — alternating above/below */}
      <div className="flex w-full" style={{ height: 56 }}>
        {genres.map((g, i) => {
          const pct = (g.plays / total) * 100;
          const above = i % 2 === 0;
          return (
            <div key={g.genre} style={{ width: `${pct}%`, flexShrink: 0 }} className="relative">
              {above && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 1, background: GENRE_COLORS[i % GENRE_COLORS.length] }} />}
              {above && (
                <div className="absolute bottom-0 left-0 pl-2 pr-1 pb-2">
                  <p className="text-sm font-black uppercase text-white/80 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{g.genre}</p>
                  {g.episodes > 0 && <p className="text-xs text-white/40 leading-tight">{g.episodes} episode{g.episodes !== 1 ? "s" : ""}</p>}
                  {g.shows > 0 && <p className="text-xs text-white/40 leading-tight">{g.shows} show{g.shows !== 1 ? "s" : ""}</p>}
                  {g.movies > 0 && <p className="text-xs text-white/40 leading-tight">{g.movies} movie{g.movies !== 1 ? "s" : ""}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Segmented bar */}
      <div className="flex w-full h-6 overflow-hidden">
        {genres.map((g, i) => {
          const pct = (g.plays / total) * 100;
          return <div key={g.genre} style={{ width: `${pct}%`, background: GENRE_COLORS[i % GENRE_COLORS.length], flexShrink: 0, height: "100%" }} />;
        })}
      </div>
      {/* Below labels */}
      <div className="flex w-full" style={{ height: 44 }}>
        {genres.map((g, i) => {
          const pct = (g.plays / total) * 100;
          const above = i % 2 === 0;
          return (
            <div key={g.genre} style={{ width: `${pct}%`, flexShrink: 0 }} className="relative">
              {!above && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 1, background: GENRE_COLORS[i % GENRE_COLORS.length] }} />}
              {!above && (
                <div className="absolute top-0 left-0 pl-2 pr-1 pt-2">
                  <p className="text-sm font-black uppercase text-white/80 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{g.genre}</p>
                  {g.episodes > 0 && <p className="text-xs text-white/40 leading-tight">{g.episodes} episode{g.episodes !== 1 ? "s" : ""}</p>}
                  {g.shows > 0 && <p className="text-xs text-white/40 leading-tight">{g.shows} show{g.shows !== 1 ? "s" : ""}</p>}
                  {g.movies > 0 && <p className="text-xs text-white/40 leading-tight">{g.movies} movie{g.movies !== 1 ? "s" : ""}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
