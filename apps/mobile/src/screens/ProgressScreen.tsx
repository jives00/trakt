import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { ProgressItem } from "@trakt/types";

type Nav = NativeStackNavigationProp<SharedDetailParamList>;
type StatusFilter = "all" | "watching" | "completed" | "dropped";
const STATUS_FILTERS: StatusFilter[] = ["all", "watching", "completed", "dropped"];

export default function ProgressScreen() {
  const { token } = useAuth();
  const nav = useNavigation<Nav>();
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(f: StatusFilter) {
    if (!token) return;
    return api.getProgress(token, f).then(setItems);
  }

  useEffect(() => {
    load(filter).finally(() => setLoading(false));
  }, [token, filter]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(filter); } finally { setRefreshing(false); }
  }

  function handleFilterChange(f: StatusFilter) {
    setFilter(f);
    setLoading(true);
    setItems([]);
  }

  return (
    <View style={s.root}>
      <View style={s.filters}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.pill, filter === f && s.pillActive]}
            onPress={() => handleFilterChange(f)}
          >
            <Text style={[s.pillText, filter === f && s.pillTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#e8002d" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.showId)}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No shows in progress.</Text></View>}
          renderItem={({ item }) => {
            const pct = item.totalEpisodes > 0 ? item.watchedEpisodes / item.totalEpisodes : 0;
            return (
              <TouchableOpacity
                style={s.row}
                onPress={() => nav.navigate("ShowDetail", { tmdbId: item.tmdbId })}
                activeOpacity={0.85}
              >
                {item.posterPath ? (
                  <Image source={{ uri: `${TMDB_IMG}w185${item.posterPath}` }} style={s.poster} contentFit="cover" />
                ) : (
                  <View style={[s.poster, s.posterFallback]} />
                )}
                <View style={s.info}>
                  <Text style={s.title} numberOfLines={1}>{item.title}</Text>
                  {item.network ? <Text style={s.meta}>{item.network}</Text> : null}
                  <Text style={s.epCount}>{item.watchedEpisodes} / {item.totalEpisodes} episodes</Text>
                  {item.nextEpisode && (
                    <Text style={s.nextEp} numberOfLines={1}>
                      Next: S{String(item.nextEpisode.seasonNumber).padStart(2, "0")} E{String(item.nextEpisode.episodeNumber).padStart(2, "0")}
                      {item.nextEpisode.title ? ` · ${item.nextEpisode.title}` : ""}
                    </Text>
                  )}
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${pct * 100}%` }]} />
                  </View>
                  <Text style={s.pctLabel}>{Math.round(pct * 100)}%</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1c1e26" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "rgba(240,240,246,0.4)", fontSize: 15 },

  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1e2029", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  pillActive: { backgroundColor: "#e8002d", borderColor: "#e8002d" },
  pillText: { fontSize: 13, color: "rgba(240,240,246,0.6)", fontWeight: "600" },
  pillTextActive: { color: "#fff" },

  row: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "#1e2029", borderRadius: 8, overflow: "hidden",
  },
  poster: { width: 56, height: 84, backgroundColor: "#323440" },
  posterFallback: { backgroundColor: "#323440" },
  info: { flex: 1, padding: 10 },
  title: { fontSize: 14, fontWeight: "700", color: "#f0f0f6", marginBottom: 2 },
  meta: { fontSize: 11, color: "rgba(240,240,246,0.4)", marginBottom: 2 },
  epCount: { fontSize: 11, color: "rgba(240,240,246,0.55)", marginBottom: 4 },
  nextEp: { fontSize: 10, color: "#e8002d", marginBottom: 8 },
  progressTrack: { height: 3, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden", marginBottom: 3 },
  progressFill: { height: 3, backgroundColor: "#e8002d", borderRadius: 2 },
  pctLabel: { fontSize: 9, color: "rgba(240,240,246,0.3)", textAlign: "right" },
});
