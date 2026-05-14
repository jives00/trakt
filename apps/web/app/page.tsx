"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { UpNextItem, ScheduleItem, DashboardStats, DashboardDailyStats, DashboardSummary, DashboardGenre, RecentItem, RecommendationItem, StatsAllTime, UserProfile, NowPlayingItem } from "@trakt/types";
import { UpNextSection } from "@/components/up-next-section";
import { ScheduleSection } from "@/components/schedule-section";

export const dynamic = "force-dynamic";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

export default function DashboardPage() {
  const router = useRouter();
  const { token, isLoading } = useAuth();
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [showRecs, setShowRecs] = useState<RecommendationItem[]>([]);
  const [movieRecs, setMovieRecs] = useState<RecommendationItem[]>([]);
  const [alltime, setAlltime] = useState<StatsAllTime | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [nowPlaying, setNowPlaying] = useState<NowPlayingItem | null>(null);

  useEffect(() => {
    if (isLoading || !token) return;
    Promise.all([
      api.getProfile(token),
      api.getUpNext(token),
      api.getSchedule(token, 30),
      api.getDashboardStats(token),
      api.getRecentItems(token, 3),
      api.getStatsAllTime(token),
      api.getShowRecommendations(token),
      api.getMovieRecommendations(token),
    ])
      .then(([prof, up, sched, stats, recent, at, srecs, mrecs]) => {
        setProfile(prof); setUpNext(up); setSchedule(sched); setDashStats(stats);
        setRecentItems(recent); setAlltime(at); setShowRecs(srecs); setMovieRecs(mrecs);
      })
      .catch(() => setFetchError("Failed to load dashboard."))
      .finally(() => setFetching(false));
  }, [token, isLoading]);

  useEffect(() => {
    if (!token) return;
    const poll = () => api.getNowPlaying(token).then(r => setNowPlaying(r ?? null)).catch(() => {});
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [token]);

  if (isLoading || fetching) return null;
  if (fetchError) return <p className="text-error">{fetchError}</p>;

  const greeting = profile?.displayName || profile?.username || "there";

  return (
    <div className="flex flex-col flex-1">
      {nowPlaying ? <NowPlayingHero item={nowPlaying} /> : <HeroSection username={greeting} alltime={alltime} />}
      <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full flex flex-col gap-stack-lg">
        <UpNextSection items={upNext} />
        <ScheduleSection entries={schedule} />
        {dashStats && <StatsBarChart data={dashStats.daily} summary={dashStats.summary} genres={dashStats.genres} onBarClick={(date) => router.push(`/history?date=${date}`)} />}
        <RecentSection items={recentItems} />
        <RecommendationsSection showRecs={showRecs} movieRecs={movieRecs} />
      </div>
    </div>
  );
}

function HeroSection({ username, alltime }: { username: string; alltime: StatsAllTime | null }) {
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
            filter: 'blur(3px) brightness(0.8)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent z-0" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-8">
          <div>
            <h1 className="text-h1 font-black tracking-tight text-white mb-4 capitalize">Hello, {username}</h1>
            {alltime && (
              <div className="flex gap-8 md:gap-12">
                <Stat label="Movies Watched" value={alltime.totalMovies.toLocaleString()} />
                <Stat label="Shows Watched" value={alltime.totalShows.toLocaleString()} />
                <Stat label="Episodes Watched" value={alltime.totalEpisodes.toLocaleString()} />
              </div>
            )}
          </div>
            {/* Now Playing card – renders only when scrobble is active (Phase 2+) */}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">{label}</p>
      <p className="text-h2 font-black text-white">{value}</p>
    </div>
  );
}

function RecentSection({ items }: { items: RecentItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>Recently Watched</SectionHeading>
      <div className="grid grid-cols-3 gap-gutter">
        {items.slice(0, 3).map((item) => <RecentCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

function RecentCard({ item }: { item: RecentItem }) {
  const isEpisode = item.mediaType === "episode";
  const href = item.tmdbId
    ? isEpisode && item.seasonNumber != null && item.episodeNumber != null
      ? `/shows/${item.tmdbId}/seasons/${item.seasonNumber}/episodes/${item.episodeNumber}`
      : isEpisode ? `/shows/${item.tmdbId}` : `/movies/${item.tmdbId}`
    : "#";
  const imagePath = isEpisode ? (item.stillPath ?? item.posterPath) : item.posterPath;
  const posterUrl = imagePath ? `${TMDB_IMG}w500${imagePath}` : null;
  const title = isEpisode ? (item.showTitle ?? item.title) : item.title;

  return (
    <Link href={href} className="group relative aspect-video overflow-hidden border border-outline-variant/30 cursor-pointer block">
      {posterUrl ? (
        <Image src={posterUrl} alt={title ?? ""} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover object-center transition-transform duration-500 group-hover:scale-110" />
      ) : (
        <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">{isEpisode ? "tv" : "movie"}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent flex flex-col justify-end p-5">
        {isEpisode && item.seasonNumber != null && item.episodeNumber != null && (
          <p className="text-white text-[10px] font-black uppercase tracking-widest mb-1">
            S{String(item.seasonNumber).padStart(2, "0")} E{String(item.episodeNumber).padStart(2, "0")}
          </p>
        )}
        <h3 className="text-white font-bold text-lg">{title}</h3>
        {isEpisode && item.title && item.showTitle && (
          <p className="text-white/50 text-sm">{item.title}</p>
        )}
        {!isEpisode && item.tagline && (
          <p className="text-white/50 text-sm">{item.tagline}</p>
        )}
      </div>
    </Link>
  );
}

function RecommendationsSection({ showRecs, movieRecs }: { showRecs: RecommendationItem[]; movieRecs: RecommendationItem[] }) {
  if (showRecs.length === 0 && movieRecs.length === 0) return null;
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
      {showRecs.length > 0 && <RecPanel title="Show Recommendations" items={showRecs} linkPrefix="/shows" />}
      {movieRecs.length > 0 && <RecPanel title="Movie Recommendations" items={movieRecs} linkPrefix="/movies" />}
    </section>
  );
}

function RecPanel({ title, items, linkPrefix }: { title: string; items: RecommendationItem[]; linkPrefix: string }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="block h-8 w-1 rounded-full bg-accent" />
        <h2 className="text-h2 font-black text-on-surface">{title}</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <Link key={item.tmdbId} href={`${linkPrefix}/${item.tmdbId}`} className="group relative">
            <div className="relative aspect-[2/3] overflow-hidden bg-surface-container-high transition-transform duration-300 group-hover:scale-[1.02]">
              {item.posterPath ? (
                <Image src={`${TMDB_IMG}w185${item.posterPath}`} alt={item.title} fill sizes="33vw" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="material-symbols-outlined text-2xl text-on-surface-variant/40">image_not_supported</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent flex flex-col justify-end p-3">
                <p className="text-sm font-black text-white leading-tight line-clamp-2">{item.title}</p>
                {item.year && <p className="text-[13px] text-white/50 mt-0.5">{item.year}</p>}
              </div>
            </div>
          </Link>
        ))}
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

function StatsBarChart({ data, summary, genres, onBarClick }: { data: DashboardDailyStats[]; summary: DashboardSummary; genres: DashboardGenre[]; onBarClick?: (date: string) => void }) {
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
      dateStr,
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
          <p className="text-sm text-on-surface-variant/70 mt-1 ml-4">{summaryParts.join(" - ")}</p>
        )}
      </div>
      <div className="glass-panel p-5 rounded-xl flex-1">
        <div className="h-48 mb-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: "rgb(var(--on-surface-rgb) / 0.3)", fontSize: 9 }} interval={0} />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as typeof chartData[0];
                  const h = Math.floor(p.totalMinutes / 60);
                  const m = Math.round(p.totalMinutes % 60);
                  const time = [h > 0 && `${h}h`, m > 0 && `${m}m`].filter(Boolean).join(" ") || "0m";
                  return (
                    <div style={{ background: "rgb(var(--surface-container-rgb))", border: "1px solid rgb(var(--on-surface-rgb) / 0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "rgb(var(--on-surface-rgb) / 0.85)", lineHeight: "1.6" }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{time} watched</div>
                      {p.episodes > 0 && <div style={{ color: "rgb(var(--on-surface-rgb) / 0.55)" }}>{p.episodes} episode{p.episodes !== 1 ? "s" : ""}</div>}
                      {p.movies > 0 && <div style={{ color: "rgb(var(--on-surface-rgb) / 0.55)" }}>{p.movies} movie{p.movies !== 1 ? "s" : ""}</div>}
                    </div>
                  );
                }}
              />
              <Bar dataKey="hours" radius={[3, 3, 0, 0]} onMouseLeave={() => setActiveBar(null)}>
                {chartData.map((item, i) => (
                  <Cell
                    key={i}
                    fill={activeBar === i ? "rgb(var(--accent-rgb))" : "rgb(var(--on-surface-rgb) / 0.2)"}
                    onMouseEnter={() => setActiveBar(i)}
                    onClick={() => onBarClick?.(item.dateStr)}
                    style={{ cursor: onBarClick ? "pointer" : "default" }}
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
  const [hovered, setHovered] = useState<number | null>(null);
  const total = genres.reduce((sum, g) => sum + g.plays, 0);
  const h = hovered !== null ? genres[hovered] : null;

  return (
    <div className="mt-2">
      <div className="flex w-full h-10 overflow-hidden">
        {genres.map((g, i) => {
          const pct = (g.plays / total) * 100;
          return (
            <div
              key={g.genre}
              style={{ width: `${pct}%`, background: GENRE_COLORS[i % GENRE_COLORS.length], flexShrink: 0, opacity: hovered === null || hovered === i ? 1 : 0.35, transition: "opacity 0.15s" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </div>
      <div className="h-7 mt-2 flex items-center">
        {h && (
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 flex-none" style={{ background: GENRE_COLORS[genres.indexOf(h) % GENRE_COLORS.length] }} />
            <span className="text-sm font-black uppercase text-on-surface">{h.genre}</span>
            <span className="text-[13px] text-on-surface-variant/70">
              {[h.episodes > 0 && `${h.episodes} ep`, h.shows > 0 && `${h.shows} show${h.shows !== 1 ? "s" : ""}`, h.movies > 0 && `${h.movies} movie${h.movies !== 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
            </span>
            <span className="text-[13px] font-bold text-on-surface-variant/40">{Math.round((h.plays / total) * 100)}%</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
        {genres.map((g, i) => (
          <div key={g.genre} className="flex items-center gap-1.5">
            <span className="w-2 h-2 flex-none" style={{ background: GENRE_COLORS[i % GENRE_COLORS.length] }} />
            <span className="text-[13px] font-bold uppercase tracking-wide text-on-surface-variant/70">{g.genre}</span>
          </div>
        ))}
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

function NowPlayingHero({ item }: { item: NowPlayingItem }) {
  const isEpisode = item.mediaType === 'episode';
  const title = isEpisode ? item.showTitle : item.movieTitle;
  const rawBg = isEpisode ? (item.showBackdropPath ?? item.stillPath) : item.backdropPath;
  const bgUrl = rawBg ? `${TMDB_IMG}original${rawBg}` : null;

  const titleHref = isEpisode && item.showTmdbId
    ? `/shows/${item.showTmdbId}`
    : !isEpisode && item.movieTmdbId
    ? `/movies/${item.movieTmdbId}`
    : null;

  const episodeHref = isEpisode && item.showTmdbId && item.seasonNumber != null && item.episodeNumber != null
    ? `/shows/${item.showTmdbId}/seasons/${item.seasonNumber}/episodes/${item.episodeNumber}`
    : null;

  const subLine = isEpisode && item.seasonNumber != null && item.episodeNumber != null
    ? `S${String(item.seasonNumber).padStart(2, '0')} E${String(item.episodeNumber).padStart(2, '0')}${item.episodeTitle ? ` · ${item.episodeTitle}` : ''}`
    : (item.tagline ?? '');

  const runtimeMin = isEpisode ? item.showRuntimeMin : item.runtimeMin;
  const watchedMin = runtimeMin != null ? Math.round(item.progressPct / 100 * runtimeMin) : null;
  const remainingMin = runtimeMin != null ? Math.max(0, runtimeMin - (watchedMin ?? 0)) : null;
  const fmt = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  return (
    <section className="relative overflow-hidden bg-black">
      {bgUrl && <Image src={bgUrl} alt={title ?? ''} fill sizes="100vw" className="object-cover object-center" priority />}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/10" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
      <div className="relative z-10 px-margin-page pt-10 pb-6 flex flex-col justify-between min-h-[220px] md:min-h-[300px]">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Now Playing</span>
          </div>
          {titleHref ? (
            <Link href={titleHref}>
              <h1 className="text-h1 font-black tracking-tight text-white mb-1 hover:text-white/80 transition-colors">{title}</h1>
            </Link>
          ) : (
            <h1 className="text-h1 font-black tracking-tight text-white mb-1">{title}</h1>
          )}
          {subLine && (
            episodeHref ? (
              <Link href={episodeHref}>
                <p className="text-sm text-white/60 font-medium hover:text-white transition-colors">{subLine}</p>
              </Link>
            ) : (
              <p className="text-sm text-white/60 font-medium">{subLine}</p>
            )
          )}
        </div>
        <div className="mt-6">
          <div className="flex justify-between items-baseline mb-2">
            {watchedMin != null
              ? <span className="text-xs text-white/50 tabular-nums">{fmt(watchedMin)} watched</span>
              : <span />}
            <span className="text-xs font-black text-white tabular-nums">{item.progressPct}%</span>
            {remainingMin != null
              ? <span className="text-xs text-white/50 tabular-nums">{fmt(remainingMin)} left</span>
              : <span />}
          </div>
          <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-1000" style={{ width: `${item.progressPct}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

