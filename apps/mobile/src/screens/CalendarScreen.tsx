import { useEffect, useState } from "react";
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { groupByDate } from "../lib/format";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { ScheduleItem } from "@trakt/types";

type Nav = NativeStackNavigationProp<SharedDetailParamList>;

type RangeOption = { label: string; days: number };
const RANGE_OPTIONS: RangeOption[] = [
  { label: "7 Days", days: 7 },
  { label: "14 Days", days: 14 },
  { label: "30 Days", days: 30 },
];

export default function CalendarScreen() {
  const { token } = useAuth();
  const nav = useNavigation<Nav>();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [range, setRange] = useState(14);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(r: number) {
    if (!token) return;
    return api.getSchedule(token, r).then(setItems);
  }

  useEffect(() => {
    setLoading(true);
    load(range).finally(() => setLoading(false));
  }, [token, range]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(range); } finally { setRefreshing(false); }
  }

  const sections = groupByDate(items);

  return (
    <View style={s.root}>
      {/* Range picker */}
      <View style={s.rangeRow}>
        {RANGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.days}
            style={[s.rangeBtn, range === opt.days && s.rangeBtnActive]}
            onPress={() => setRange(opt.days)}
          >
            <Text style={[s.rangeBtnText, range === opt.days && s.rangeBtnTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#e8002d" /></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.showTmdbId ?? item.movieTmdbId}-${item.seasonNumber}-${item.episodeNumber}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No upcoming episodes.</Text></View>}
          renderSectionHeader={({ section }) => (
            <View style={s.dayHeader}>
              <Text style={s.dayTitle}>{section.title}</Text>
              <View style={s.dayDivider} />
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              onPress={() => item.showTmdbId ? nav.navigate("ShowDetail", { tmdbId: item.showTmdbId }) : null}
              activeOpacity={0.85}
            >
              {item.posterPath ? (
                <Image source={{ uri: `${TMDB_IMG}w92${item.posterPath}` }} style={s.poster} contentFit="cover" />
              ) : (
                <View style={[s.poster, s.posterFallback]} />
              )}
              <View style={s.info}>
                <Text style={s.showTitle} numberOfLines={1}>{item.showTitle ?? item.movieTitle}</Text>
                <Text style={s.epLine}>
                  S{String(item.seasonNumber).padStart(2, "0")} E{String(item.episodeNumber).padStart(2, "0")}
                  {item.episodeTitle ? ` · ${item.episodeTitle}` : ""}
                </Text>
                {item.network ? <Text style={s.network}>{item.network}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1d1d1d" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "rgba(226,226,226,0.4)", fontSize: 15 },

  rangeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  rangeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1a1c1c", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  rangeBtnActive: { backgroundColor: "#e8002d", borderColor: "#e8002d" },
  rangeBtnText: { fontSize: 13, color: "rgba(226,226,226,0.6)", fontWeight: "600" },
  rangeBtnTextActive: { color: "#fff" },

  dayHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  dayTitle: { fontSize: 13, fontWeight: "800", color: "#e2e2e2" },
  dayDivider: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.05)" },

  row: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, backgroundColor: "#1a1c1c", borderRadius: 8, overflow: "hidden" },
  poster: { width: 40, height: 60, backgroundColor: "#282a2b" },
  posterFallback: { backgroundColor: "#282a2b" },
  info: { flex: 1, padding: 10 },
  showTitle: { fontSize: 13, fontWeight: "700", color: "#e2e2e2", marginBottom: 2 },
  epLine: { fontSize: 11, color: "#888", marginBottom: 2 },
  network: { fontSize: 10, color: "rgba(226,226,226,0.35)", letterSpacing: 0.5 },
});
