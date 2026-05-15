import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { RootStackParamList } from "../navigation/types";
import type { StatsAllTime } from "@trakt/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function formatMinutes(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export default function StatsScreen() {
  const { token } = useAuth();
  const nav = useNavigation<Nav>();
  const [stats, setStats] = useState<StatsAllTime | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.getStatsAllTime(token)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" size="large" /></View>;
  }
  if (!stats) {
    return <View style={s.center}><Text style={s.emptyText}>No stats available.</Text></View>;
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* All-time summary chips */}
      <View style={s.chipGrid}>
        <StatChip label="Total Time" value={formatMinutes(stats.totalMinutes)} accent />
        <StatChip label="Episodes" value={stats.totalEpisodes.toLocaleString()} />
        <StatChip label="Movies" value={stats.totalMovies.toLocaleString()} />
        <StatChip label="Shows" value={stats.totalShows.toLocaleString()} />
        <StatChip label="Longest Streak" value={`${stats.longestStreak}d`} />
      </View>

      {/* Year drill-down */}
      <SectionHeader title="By Year" />
      <View style={s.yearRow}>
        {YEARS.map((y) => (
          <TouchableOpacity
            key={y}
            style={s.yearBtn}
            onPress={() => nav.navigate("StatsYear", { year: y })}
          >
            <Text style={s.yearBtnText}>{y}</Text>
            <Text style={s.yearBtnChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Top Shows */}
      {stats.topShows.length > 0 && (
        <>
          <SectionHeader title="Top Shows" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {stats.topShows.slice(0, 10).map((show) => (
              <TouchableOpacity
                key={show.tmdbId}
                style={s.topShowCard}
                onPress={() => nav.navigate("ShowDetail", { tmdbId: show.tmdbId })}
              >
                {show.posterPath ? (
                  <Image source={{ uri: `${TMDB_IMG}w185${show.posterPath}` }} style={s.topShowPoster} contentFit="cover" />
                ) : (
                  <View style={[s.topShowPoster, s.posterFallback]} />
                )}
                <Text style={s.topShowTitle} numberOfLines={2}>{show.title}</Text>
                <Text style={s.topShowEps}>{show.episodeCount} eps</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Top Genres */}
      {stats.topGenres.length > 0 && (
        <>
          <SectionHeader title="Top Genres" />
          <View style={s.genreList}>
            {stats.topGenres.slice(0, 8).map((g, i) => {
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
  root: { flex: 1, backgroundColor: "#1d1d1d" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1d1d1d" },
  emptyText: { color: "rgba(226,226,226,0.4)", fontSize: 15 },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 16 },
  chip: { flex: 1, minWidth: "40%", backgroundColor: "#1a1c1c", borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  chipValue: { fontSize: 22, fontWeight: "900", color: "#e2e2e2", marginBottom: 3 },
  chipValueAccent: { color: "#e8002d" },
  chipLabel: { fontSize: 9, color: "rgba(226,226,226,0.4)", fontWeight: "700", letterSpacing: 1.5 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  sectionAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: "#e8002d" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#e2e2e2" },

  yearRow: { paddingHorizontal: 16, gap: 8 },
  yearBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, backgroundColor: "#1a1c1c", borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  yearBtnText: { fontSize: 16, fontWeight: "700", color: "#e2e2e2" },
  yearBtnChevron: { fontSize: 20, color: "#e8002d" },

  topShowCard: { width: 80 },
  topShowPoster: { width: 80, height: 120, borderRadius: 6, backgroundColor: "#282a2b" },
  posterFallback: { backgroundColor: "#282a2b" },
  topShowTitle: { fontSize: 10, color: "#cccccc", marginTop: 5, lineHeight: 13 },
  topShowEps: { fontSize: 9, color: "#888", marginTop: 2 },

  genreList: { paddingHorizontal: 16, gap: 10 },
  genreRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  genreRank: { width: 20, fontSize: 12, fontWeight: "700", color: "#e8002d", textAlign: "right" },
  genreBarContainer: { flex: 1 },
  genreName: { fontSize: 12, color: "#e2e2e2", marginBottom: 4 },
  genreBarTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" },
  genreBarFill: { height: 4, backgroundColor: "#e8002d", borderRadius: 2 },
  genreCount: { fontSize: 11, fontWeight: "700", color: "rgba(226,226,226,0.4)", width: 32, textAlign: "right" },
});
