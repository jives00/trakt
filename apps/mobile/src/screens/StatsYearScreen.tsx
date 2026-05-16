import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { StatsYear } from "@trakt/types";

type Props = NativeStackScreenProps<SharedDetailParamList, "StatsYear">;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMinutes(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export default function StatsYearScreen({ route, navigation }: Props) {
  const { year } = route.params;
  const { token } = useAuth();
  const [stats, setStats] = useState<StatsYear | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!token) return;
    return api.getStatsYear(year, token).then(setStats);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [year, token]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" size="large" /></View>;
  }
  if (!stats) {
    return <View style={s.center}><Text style={s.emptyText}>No stats for {year}.</Text></View>;
  }

  const maxHours = Math.max(...stats.monthlyBreakdown.map((m) => m.hours), 1);

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}>
      {/* Summary */}
      <View style={s.chipGrid}>
        <StatChip label="Time Watched" value={formatMinutes(stats.totalMinutes)} accent />
        <StatChip label="Episodes" value={stats.totalEpisodes.toLocaleString()} />
        <StatChip label="Movies" value={stats.totalMovies.toLocaleString()} />
        <StatChip label="Shows Started" value={stats.newShowsStarted.toLocaleString()} />
        <StatChip label="Shows Finished" value={stats.showsCompleted.toLocaleString()} />
      </View>

      {/* Monthly bar chart */}
      <SectionHeader title="Monthly Breakdown" />
      <View style={s.barChart}>
        {stats.monthlyBreakdown.map((m) => {
          const pct = m.hours / maxHours;
          return (
            <TouchableOpacity
              key={m.month}
              style={s.barCol}
              onPress={() => navigation.navigate("StatsMonth", { year, month: m.month })}
            >
              <Text style={s.barValue}>{m.hours > 0 ? `${Math.round(m.hours)}h` : ""}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { height: `${pct * 100}%` }]} />
              </View>
              <Text style={s.barLabel}>{MONTHS[m.month - 1]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Top Shows */}
      {stats.topShows.length > 0 && (
        <>
          <SectionHeader title="Top Shows" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {stats.topShows.slice(0, 10).map((show) => (
              <View key={show.tmdbId} style={s.showCard}>
                {show.posterPath ? (
                  <Image source={{ uri: `${TMDB_IMG}w185${show.posterPath}` }} style={s.showPoster} contentFit="cover" />
                ) : (
                  <View style={[s.showPoster, s.posterFallback]} />
                )}
                <Text style={s.showTitle} numberOfLines={2}>{show.title}</Text>
                <Text style={s.showEps}>{show.episodeCount} eps</Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* Top Genres */}
      {stats.topGenres.length > 0 && (
        <>
          <SectionHeader title="Top Genres" />
          <View style={s.genreList}>
            {stats.topGenres.slice(0, 6).map((g, i) => {
              const max = stats.topGenres[0]!.count;
              const pct = g.count / max;
              return (
                <View key={g.genre} style={s.genreRow}>
                  <Text style={s.genreRank}>{i + 1}</Text>
                  <View style={s.genreBarContainer}>
                    <Text style={s.genreName}>{g.genre}</Text>
                    <View style={s.genreBarTrack}>
                      <View style={[s.genreBarFill, { width: `${pct * 100}%` }]} />
                    </View>
                  </View>
                  <Text style={s.genreCount}>{g.count}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.chip}>
      <Text style={[s.chipValue, accent && s.chipValueAccent]}>{value}</Text>
      <Text style={s.chipLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionAccent} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1c1e26" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1c1e26" },
  emptyText: { color: "rgba(240,240,246,0.4)", fontSize: 15 },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 16 },
  chip: { flex: 1, minWidth: "40%", backgroundColor: "#1e2029", borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  chipValue: { fontSize: 20, fontWeight: "900", color: "#f0f0f6", marginBottom: 3 },
  chipValueAccent: { color: "#e8002d" },
  chipLabel: { fontSize: 9, color: "rgba(240,240,246,0.4)", fontWeight: "700", letterSpacing: 1.5 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  sectionAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: "#e8002d" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#f0f0f6" },

  barChart: { flexDirection: "row", paddingHorizontal: 16, gap: 4, height: 120, alignItems: "flex-end" },
  barCol: { flex: 1, alignItems: "center", height: "100%" },
  barValue: { fontSize: 7, color: "#e8002d", marginBottom: 2, height: 10 },
  barTrack: { flex: 1, width: "70%", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", justifyContent: "flex-end" },
  barFill: { width: "100%", backgroundColor: "#e8002d", borderRadius: 2 },
  barLabel: { fontSize: 8, color: "rgba(240,240,246,0.4)", marginTop: 4 },

  showCard: { width: 80 },
  showPoster: { width: 80, height: 120, borderRadius: 6, backgroundColor: "#323440" },
  posterFallback: { backgroundColor: "#323440" },
  showTitle: { fontSize: 10, color: "#d7d8e2", marginTop: 5, lineHeight: 13 },
  showEps: { fontSize: 9, color: "#888", marginTop: 2 },

  genreList: { paddingHorizontal: 16, gap: 10 },
  genreRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  genreRank: { width: 20, fontSize: 12, fontWeight: "700", color: "#e8002d", textAlign: "right" },
  genreBarContainer: { flex: 1 },
  genreName: { fontSize: 12, color: "#f0f0f6", marginBottom: 4 },
  genreBarTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" },
  genreBarFill: { height: 4, backgroundColor: "#e8002d", borderRadius: 2 },
  genreCount: { fontSize: 11, fontWeight: "700", color: "rgba(240,240,246,0.4)", width: 32, textAlign: "right" },
});
