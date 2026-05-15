import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { RootStackParamList } from "../navigation/types";
import type { StatsMonth } from "@trakt/types";

type Props = NativeStackScreenProps<RootStackParamList, "StatsMonth">;

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatMinutes(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export default function StatsMonthScreen({ route }: Props) {
  const { year, month } = route.params;
  const { token } = useAuth();
  const [stats, setStats] = useState<StatsMonth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.getStatsMonth(year, month, token)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [year, month, token]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" size="large" /></View>;
  }
  if (!stats) {
    return <View style={s.center}><Text style={s.emptyText}>No stats for this month.</Text></View>;
  }

  const maxHours = Math.max(...stats.dailyBreakdown.map((d) => d.hours), 0.1);
  const daysInMonth = new Date(year, month, 0).getDate();

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.titleRow}>
        <Text style={s.monthTitle}>{MONTH_NAMES[month - 1]} {year}</Text>
      </View>

      {/* Summary */}
      <View style={s.chipGrid}>
        <StatChip label="Time Watched" value={formatMinutes(stats.totalMinutes)} accent />
        <StatChip label="Episodes" value={stats.totalEpisodes.toLocaleString()} />
        <StatChip label="Movies" value={stats.totalMovies.toLocaleString()} />
      </View>

      {/* Daily bar chart */}
      <SectionHeader title="Daily Activity" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 3, height: 80, alignItems: "flex-end" }}>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const entry = stats.dailyBreakdown.find((d) => d.day === day);
          const hours = entry?.hours ?? 0;
          const pct = hours / maxHours;
          return (
            <View key={day} style={s.dayCol}>
              <View style={[s.dayBar, { height: Math.max(pct * 50, 2) }]} />
              {day % 5 === 0 ? <Text style={s.dayLabel}>{day}</Text> : <Text style={s.dayLabel}> </Text>}
            </View>
          );
        })}
      </ScrollView>

      {/* Top Shows */}
      {stats.shows.length > 0 && (
        <>
          <SectionHeader title="Shows Watched" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {stats.shows.map((show) => (
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

      {/* Movies */}
      {stats.movies.length > 0 && (
        <>
          <SectionHeader title="Movies Watched" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {stats.movies.map((movie) => (
              <View key={movie.tmdbId} style={s.showCard}>
                {movie.posterPath ? (
                  <Image source={{ uri: `${TMDB_IMG}w185${movie.posterPath}` }} style={s.showPoster} contentFit="cover" />
                ) : (
                  <View style={[s.showPoster, s.posterFallback]} />
                )}
                <Text style={s.showTitle} numberOfLines={2}>{movie.title}</Text>
              </View>
            ))}
          </ScrollView>
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
  titleRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  monthTitle: { fontSize: 22, fontWeight: "900", color: "#e2e2e2" },

  chipGrid: { flexDirection: "row", gap: 12, padding: 16 },
  chip: { flex: 1, backgroundColor: "#1a1c1c", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  chipValue: { fontSize: 18, fontWeight: "900", color: "#e2e2e2", marginBottom: 3 },
  chipValueAccent: { color: "#e8002d" },
  chipLabel: { fontSize: 8, color: "rgba(226,226,226,0.4)", fontWeight: "700", letterSpacing: 1.5 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  sectionAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: "#e8002d" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#e2e2e2" },

  dayCol: { alignItems: "center", width: 14 },
  dayBar: { width: 8, backgroundColor: "#e8002d", borderRadius: 2, marginBottom: 2 },
  dayLabel: { fontSize: 7, color: "rgba(226,226,226,0.3)" },

  showCard: { width: 70 },
  showPoster: { width: 70, height: 105, borderRadius: 6, backgroundColor: "#282a2b" },
  posterFallback: { backgroundColor: "#282a2b" },
  showTitle: { fontSize: 9, color: "#cccccc", marginTop: 4, lineHeight: 12 },
  showEps: { fontSize: 8, color: "#888", marginTop: 2 },
});
