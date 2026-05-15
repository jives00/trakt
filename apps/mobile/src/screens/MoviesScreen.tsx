import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { HistoryItem } from "@trakt/types";

type Nav = NativeStackNavigationProp<SharedDetailParamList>;

const { width: SCREEN_W } = Dimensions.get("window");
const COLS = 3;
const GAP = 8;
const CARD_W = (SCREEN_W - GAP * (COLS + 1)) / COLS;

type Movie = { tmdbId: number; title: string; posterPath: string | null };

function dedupeMovies(items: HistoryItem[]): Movie[] {
  const seen = new Set<number>();
  const result: Movie[] = [];
  for (const item of items) {
    if (item.mediaType !== "movie" || !item.tmdbId) continue;
    if (seen.has(item.tmdbId)) continue;
    seen.add(item.tmdbId);
    result.push({ tmdbId: item.tmdbId, title: item.title ?? "Unknown", posterPath: item.posterPath });
  }
  return result;
}

export default function MoviesScreen() {
  const { token } = useAuth();
  const nav = useNavigation<Nav>();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function loadPage(p: number, reset = false) {
    if (!token) return;
    try {
      const data = await api.getHistory(token, "movie", p, 100);
      const newMovies = dedupeMovies(data.items);
      setMovies((prev) => reset ? newMovies : [...prev, ...newMovies]);
      setHasMore(data.items.length === 100);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadPage(1, true);
  }, [token]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await loadPage(1, true); setPage(1); } finally { setRefreshing(false); }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    await loadPage(next);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" size="large" /></View>;
  }

  return (
    <FlatList
      style={s.root}
      data={movies}
      keyExtractor={(item) => String(item.tmdbId)}
      numColumns={COLS}
      contentContainerStyle={{ padding: GAP, gap: GAP, paddingBottom: 40 }}
      columnWrapperStyle={{ gap: GAP }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No movies watched yet.</Text></View>}
      ListFooterComponent={loadingMore ? <ActivityIndicator color="#e8002d" style={{ marginVertical: 16 }} /> : null}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={s.card}
          onPress={() => nav.navigate("MovieDetail", { tmdbId: item.tmdbId })}
          activeOpacity={0.85}
        >
          {item.posterPath ? (
            <Image source={{ uri: `${TMDB_IMG}w185${item.posterPath}` }} style={s.poster} contentFit="cover" />
          ) : (
            <View style={[s.poster, s.posterFallback]} />
          )}
          <Text style={s.title} numberOfLines={2}>{item.title}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1d1d1d" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "rgba(226,226,226,0.4)", fontSize: 15 },

  card: { width: CARD_W },
  poster: { width: CARD_W, height: CARD_W * 1.5, borderRadius: 6, backgroundColor: "#282a2b" },
  posterFallback: { backgroundColor: "#282a2b" },
  title: { fontSize: 10, color: "#cccccc", marginTop: 5, lineHeight: 13 },
});
