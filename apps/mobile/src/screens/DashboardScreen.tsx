import { useEffect, useState } from "react";
import { View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { UpNextItem, ScheduleItem, DashboardStats, RecentItem } from "@trakt/types";

type Nav = NativeStackNavigationProp<SharedDetailParamList>;

const { width: SCREEN_W } = Dimensions.get("window");
const POSTER_W = 90;
const POSTER_H = 135;

export default function DashboardScreen() {
  const { token } = useAuth();
  const nav = useNavigation<Nav>();
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!token) return;
    return Promise.all([
      api.getUpNext(token),
      api.getSchedule(token, 14),
      api.getDashboardStats(token),
      api.getRecentItems(token, 8),
    ]).then(([up, sched, stats, recent]) => {
      setUpNext(up); setSchedule(sched); setDashStats(stats); setRecentItems(recent);
    });
  }

  useEffect(() => {
    if (!token) return;
    load().finally(() => setLoading(false));
  }, [token]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" /></View>;
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
    <ScrollView style={s.root} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.logoRow}>
          <Image source={require("../../assets/logo-glyph.svg")} style={s.logoGlyph} contentFit="contain" />
          <Text style={s.wordmark}>TRAKT</Text>
        </View>
      </View>

      {upNext.length > 0 && (
        <Section title="Up Next">
          <FlatList
            horizontal
            data={upNext}
            keyExtractor={(i, idx) => String(i.showTmdbId ?? idx)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => nav.navigate("EpisodeDetail", { tmdbId: item.showTmdbId, seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber, showName: item.showTitle })}>
                <View style={s.posterCard}>
                  {item.posterPath ? (
                    <Image source={{ uri: `${TMDB_IMG}w185${item.posterPath}` }} style={s.posterImg} contentFit="cover" />
                  ) : (
                    <View style={[s.posterImg, s.posterFallback]} />
                  )}
                  <Text style={s.posterLabel} numberOfLines={2}>{item.showTitle}</Text>
                  <Text style={s.posterMeta}>
                    S{String(item.seasonNumber).padStart(2, "0")} E{String(item.episodeNumber).padStart(2, "0")}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </Section>
      )}

      {dashStats && dashStats.daily.length > 0 && (
        <ActivityGraph daily={dashStats.daily} />
      )}

      {schedule.length > 0 && (
        <Section title="Upcoming Schedule">
          {schedule.slice(0, 8).map((item) => {
            const isMovie = item.mediaType === "movie";
            const title = isMovie ? item.movieTitle : item.showTitle;
            const key = isMovie
              ? `movie-${item.movieTmdbId}`
              : `${item.showTmdbId}-${item.seasonNumber}-${item.episodeNumber}`;
            return (
              <TouchableOpacity
                key={key}
                style={s.schedRow}
                onPress={() => {
                  if (isMovie && item.movieTmdbId) nav.navigate("MovieDetail", { tmdbId: item.movieTmdbId });
                  else if (!isMovie && item.showTmdbId && item.seasonNumber != null && item.episodeNumber != null)
                    nav.navigate("EpisodeDetail", { tmdbId: item.showTmdbId, seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber, showName: item.showTitle ?? "" });
                }}
              >
                <View style={s.schedDate}>
                  <Text style={s.schedDateText}>{new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
                </View>
                {item.posterPath ? (
                  <Image source={{ uri: `${TMDB_IMG}w92${item.posterPath}` }} style={s.schedPoster} contentFit="cover" />
                ) : (
                  <View style={[s.schedPoster, s.posterFallback]} />
                )}
                <View style={s.schedInfo}>
                  <Text style={s.schedTitle} numberOfLines={1}>{title}</Text>
                  {!isMovie && item.seasonNumber != null && item.episodeNumber != null && (
                    <Text style={s.schedEp} numberOfLines={1}>
                      S{String(item.seasonNumber).padStart(2, "0")} E{String(item.episodeNumber).padStart(2, "0")}{item.episodeTitle ? ` · ${item.episodeTitle}` : ""}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </Section>
      )}

      {recentItems.length > 0 && (
        <Section title="Recently Watched">
          <FlatList
            horizontal
            data={recentItems}
            keyExtractor={(i, idx) => String(i.id ?? idx)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            renderItem={({ item }) => {
              const imgPath = item.mediaType === "episode" ? item.stillPath : item.posterPath;
              const isEpisode = item.mediaType === "episode";
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (item.tmdbId) {
                      if (isEpisode && item.seasonNumber != null && item.episodeNumber != null)
                        nav.navigate("EpisodeDetail", { tmdbId: item.tmdbId, seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber, showName: item.showTitle ?? "" });
                      else if (!isEpisode)
                        nav.navigate("MovieDetail", { tmdbId: item.tmdbId });
                    }
                  }}
                >
                  <View style={s.posterCard}>
                    {imgPath ? (
                      <Image source={{ uri: `${TMDB_IMG}w185${imgPath}` }} style={s.posterImg} contentFit="cover" />
                    ) : (
                      <View style={[s.posterImg, s.posterFallback]} />
                    )}
                    <Text style={s.posterLabel} numberOfLines={2}>
                      {isEpisode ? item.showTitle ?? item.title : item.title}
                    </Text>
                    {isEpisode && item.seasonNumber != null && item.episodeNumber != null && (
                      <Text style={s.posterMeta}>
                        S{String(item.seasonNumber).padStart(2, "0")} E{String(item.episodeNumber).padStart(2, "0")}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </Section>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
    </SafeAreaView>
  );
}


function ActivityGraph({ daily }: { daily: { date: string; hours: number; episodes: number; movies: number }[] }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const anchor = Date.UTC(y, m - 1, d);
  const dataMap = new Map(daily.map((item) => [item.date.slice(0, 10), item]));

  const chartData = Array.from({ length: 14 }, (_, i) => {
    const ms = anchor - (13 - i) * 86_400_000;
    const dt = new Date(ms);
    const dateStr = dt.toISOString().slice(0, 10);
    const entry = dataMap.get(dateStr);
    return {
      label: dt.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
      hours: entry?.hours ?? 0,
      episodes: entry?.episodes ?? 0,
      movies: entry?.movies ?? 0,
    };
  });

  const maxHours = Math.max(...chartData.map((d) => d.hours), 0.1);
  const BAR_H = 60;

  const totalMins = chartData.reduce((sum, d) => sum + d.hours * 60, 0);
  const totalEps = chartData.reduce((sum, d) => sum + d.episodes, 0);
  const totalMovies = chartData.reduce((sum, d) => sum + d.movies, 0);
  const days = Math.floor(totalMins / (60 * 24));
  const hrs = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = Math.round(totalMins % 60);
  const watchTime = days > 0 ? `${days}d ${hrs}h` : hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  return (
    <Section title="Last 14 Days">
      <View style={s.graphBox}>
        <Text style={s.graphSummary}>
          {watchTime} watched · {totalEps} ep{totalEps !== 1 ? "s" : ""}{totalMovies > 0 ? ` · ${totalMovies} movie${totalMovies !== 1 ? "s" : ""}` : ""}
        </Text>
        <View style={s.graphBars}>
          {chartData.map((bar, i) => (
            <View key={i} style={s.barCol}>
              <View style={[s.barTrack, { height: BAR_H }]}>
                <View
                  style={[
                    s.barFill,
                    { height: bar.hours > 0 ? Math.max((bar.hours / maxHours) * BAR_H, 3) : 0 },
                  ]}
                />
              </View>
              <Text style={s.barLabel}>{bar.label.split("/")[1]}</Text>
            </View>
          ))}
        </View>
      </View>
    </Section>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={s.sectionAccent} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1c1e26" },
  content: { flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1c1e26" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 22, paddingBottom: 14 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  logoGlyph: { width: 26, height: 26 },
  wordmark: { fontSize: 22, fontWeight: "900", fontStyle: "italic", color: "#f0f0f6", letterSpacing: -1 },
  section: { paddingTop: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  sectionAccent: { width: 3, height: 20, borderRadius: 2, backgroundColor: "#e8002d" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#f0f0f6", letterSpacing: -0.3 },

  posterCard: { width: POSTER_W },
  posterImg: { width: POSTER_W, height: POSTER_H, borderRadius: 6, backgroundColor: "#323440" },
  posterFallback: { backgroundColor: "#323440" },
  posterLabel: { fontSize: 12, color: "#d7d8e2", marginTop: 5, lineHeight: 15 },
  posterMeta: { fontSize: 11, color: "#888", marginTop: 2 },

  schedRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  schedDate: { width: 44 },
  schedDateText: { fontSize: 12, color: "#888", textAlign: "center" },
  schedPoster: { width: 36, height: 54, borderRadius: 4 },
  schedInfo: { flex: 1 },
  schedTitle: { fontSize: 13, fontWeight: "700", color: "#f0f0f6" },
  schedEp: { fontSize: 12, color: "#888", marginTop: 2 },

  graphBox: { marginHorizontal: 16, backgroundColor: "#1e2029", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  graphSummary: { fontSize: 12, color: "rgba(240,240,246,0.45)", marginBottom: 12 },
  graphBars: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  barCol: { flex: 1, alignItems: "center" },
  barTrack: { width: "100%", justifyContent: "flex-end" },
  barFill: { width: "100%", backgroundColor: "rgba(232,0,45,0.7)", borderRadius: 2 },
  barLabel: { fontSize: 9, color: "rgba(240,240,246,0.3)", marginTop: 4 },
});
