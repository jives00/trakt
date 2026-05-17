import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { RatingItem } from "@trakt/types";
import { Ionicons } from "@expo/vector-icons";

type Nav = NativeStackNavigationProp<SharedDetailParamList>;
type FilterType = "all" | "movie" | "show" | "episode";

export default function RatingsScreen() {
  const { token } = useAuth();
  const nav = useNavigation<Nav>();
  const [items, setItems] = useState<RatingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load(f: FilterType, p: number, reset = false) {
    if (!token) return;
    try {
      const data = await api.getRatings(token, f, "date", p, 20);
      setItems((prev) => reset ? data.items : [...prev, ...data.items]);
      setTotal(data.total);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setPage(1);
    load(filter, 1, true);
  }, [filter, token]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(filter, 1, true); setPage(1); } finally { setRefreshing(false); }
  }

  async function loadMore() {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    await load(filter, next);
  }

  async function handleDelete(item: RatingItem) {
    if (!token || item.tmdbId == null) return;
    await api.deleteRating(item.mediaType, item.mediaId, token);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setTotal((t) => t - 1);
  }

  function handlePress(item: RatingItem) {
    if (!item.tmdbId) return;
    if (item.mediaType === "movie") {
      nav.navigate("MovieDetail", { tmdbId: item.tmdbId });
    } else {
      nav.navigate("ShowDetail", { tmdbId: item.tmdbId });
    }
  }

  const stars = (rating: number) => "â˜…".repeat(rating).padEnd(10, "â˜†");

  return (
    <View style={s.root}>
      <View style={s.filters}>
        {(["all", "movie", "show", "episode"] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.pill, filter === f && s.pillActive]}
            onPress={() => setFilter(f)}
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
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No ratings yet.</Text></View>}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <View style={s.footer}><ActivityIndicator color="#e8002d" /></View> : null}
          renderItem={({ item }) => {
            const displayTitle = item.mediaType === "episode" ? item.showTitle : item.title;
            const isEpisode = item.mediaType === "episode";
            return (
              <TouchableOpacity style={s.row} onPress={() => handlePress(item)} activeOpacity={0.85}>
                {item.posterPath ? (
                  <Image source={{ uri: `${TMDB_IMG}w185${item.posterPath}` }} style={s.poster} contentFit="cover" />
                ) : (
                  <View style={[s.poster, s.posterFallback]} />
                )}
                <View style={s.info}>
                  <Text style={s.stars}>{stars(item.rating)}</Text>
                  <Text style={s.title} numberOfLines={1}>{displayTitle}</Text>
                  {isEpisode && item.seasonNumber != null && item.episodeNumber != null ? (
                    <Text style={s.sub}>S{String(item.seasonNumber).padStart(2, "0")} E{String(item.episodeNumber).padStart(2, "0")}{item.title ? ` · ${item.title}` : ""}</Text>
                  ) : (
                    <Text style={s.sub}>{item.mediaType.toUpperCase()}{item.year ? ` · ${item.year}` : ""}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color="rgba(240,240,246,0.4)" />
                </TouchableOpacity>
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
  footer: { paddingVertical: 20, alignItems: "center" },

  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1e2029", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  pillActive: { backgroundColor: "#e8002d", borderColor: "#e8002d" },
  pillText: { fontSize: 13, color: "rgba(240,240,246,0.6)", fontWeight: "600" },
  pillTextActive: { color: "#fff" },

  row: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1e2029", borderRadius: 8, overflow: "hidden" },
  poster: { width: 50, height: 75, backgroundColor: "#323440" },
  posterFallback: { backgroundColor: "#323440" },
  info: { flex: 1, padding: 10 },
  stars: { fontSize: 13, color: "#e8002d", letterSpacing: 1, marginBottom: 3 },
  title: { fontSize: 13, fontWeight: "700", color: "#f0f0f6", marginBottom: 2 },
  sub: { fontSize: 10, color: "rgba(240,240,246,0.4)", textTransform: "uppercase", letterSpacing: 0.5 },
  deleteBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  deleteBtnText: { fontSize: 14, color: "rgba(240,240,246,0.25)" },
});
