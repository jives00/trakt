import { useState, useCallback, useEffect } from "react";
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import ManualScrobbleModal from "../components/ManualScrobbleModal";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { formatWatchedAt, groupByDay } from "../lib/format";
import { TMDB_IMG } from "../lib/constants";
import type { RootStackParamList } from "../navigation/types";
import type { HistoryItem } from "../lib/api";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FilterType = "all" | "movie" | "episode";

export default function HistoryScreen() {
  const { token } = useAuth();
  const nav = useNavigation<Nav>();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scrobbleOpen, setScrobbleOpen] = useState(false);

  const load = useCallback(async (f: FilterType, p: number, reset = false) => {
    if (!token) return;
    try {
      const data = await api.getHistory(token, f, p, 20);
      setItems((prev) => reset ? data.items : [...prev, ...data.items]);
      setTotal(data.total);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    load(filter, 1, true);
  }, [filter, load]);

  async function handleDelete(id: number) {
    if (!token) return;
    Alert.alert("Remove entry?", "This will delete this history entry.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          await api.deleteHistory(id, token);
          setItems((prev) => prev.filter((i) => i.id !== id));
          setTotal((t) => t - 1);
        },
      },
    ]);
  }

  async function loadMore() {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    await load(filter, next);
  }

  function handleItemPress(item: HistoryItem) {
    if (item.mediaType === "episode" && item.tmdbId != null) {
      nav.navigate("ShowDetail", { tmdbId: item.tmdbId });
    } else if (item.mediaType === "movie" && item.tmdbId != null) {
      nav.navigate("MovieDetail", { tmdbId: item.tmdbId });
    }
  }

  const sections = groupByDay(items);
  const hasMore = items.length < total;

  return (
    <View style={s.root}>
      {/* Filter pills */}
      <View style={s.filters}>
        {(["all", "movie", "episode"] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.pill, filter === f && s.pillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.pillText, filter === f && s.pillTextActive]}>
              {f === "all" ? "All Media" : f === "movie" ? "Movies" : "Episodes"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#e8002d" /></View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No watch history yet.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderSectionHeader={({ section }) => (
            <View style={s.dayHeader}>
              <Text style={s.dayTitle}>{section.title}</Text>
              <View style={s.dayDivider} />
              <Text style={s.dayCount}>{section.data.length} {section.data.length === 1 ? "ITEM" : "ITEMS"}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <HistoryCard
              item={item}
              onPress={() => handleItemPress(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={s.footerLoader}><ActivityIndicator color="#e8002d" /></View>
            ) : hasMore ? (
              <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore}>
                <Text style={s.loadMoreText}>LOAD MORE</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Manual scrobble FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setScrobbleOpen(true)}>
        <Text style={s.fabIcon}>+</Text>
      </TouchableOpacity>

      <ManualScrobbleModal visible={scrobbleOpen} onClose={() => setScrobbleOpen(false)} />
    </View>
  );
}

function HistoryCard({
  item,
  onPress,
  onDelete,
}: {
  item: HistoryItem;
  onPress: () => void;
  onDelete: () => void;
}) {
  const isEpisode = item.mediaType === "episode";
  const posterUrl = item.posterPath ? `${TMDB_IMG}w185${item.posterPath}` : null;
  const title = isEpisode ? item.showTitle : item.title;
  const hasEpInfo = isEpisode && item.seasonNumber != null && item.episodeNumber != null;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      {posterUrl ? (
        <Image source={{ uri: posterUrl }} style={s.cardPoster} contentFit="cover" />
      ) : (
        <View style={[s.cardPoster, s.posterFallback]} />
      )}
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={1}>{title}</Text>
        {hasEpInfo ? (
          <View style={s.epRow}>
            <Text style={s.epCode}>
              S{String(item.seasonNumber).padStart(2, "0")} · E{String(item.episodeNumber).padStart(2, "0")}
            </Text>
            {item.title && isEpisode && (
              <Text style={s.epName} numberOfLines={1}>{item.title}</Text>
            )}
          </View>
        ) : (
          <Text style={s.mediaTypeBadge}>MOVIE</Text>
        )}
        <View style={s.cardFooter}>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.deleteBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={s.watchedAt}>{formatWatchedAt(item.watchedAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1d1d1d" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "rgba(226,226,226,0.4)", fontSize: 15 },

  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#1a1c1c", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  pillActive: { backgroundColor: "#e8002d", borderColor: "#e8002d" },
  pillText: { fontSize: 13, color: "rgba(226,226,226,0.6)", fontWeight: "600" },
  pillTextActive: { color: "#fff" },

  dayHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10,
  },
  dayTitle: { fontSize: 15, fontWeight: "800", color: "#e2e2e2" },
  dayDivider: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.05)" },
  dayCount: { fontSize: 10, fontWeight: "900", color: "#e8002d", letterSpacing: 1.5 },

  card: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "#1a1c1c", borderRadius: 8, overflow: "hidden",
  },
  cardPoster: { width: 60, height: 90 },
  posterFallback: { backgroundColor: "#282a2b" },
  cardBody: { flex: 1, padding: 12, justifyContent: "space-between" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#e2e2e2" },
  epRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  epCode: { fontSize: 12, fontWeight: "700", color: "#e8002d" },
  epName: { fontSize: 12, color: "rgba(226,226,226,0.5)", flex: 1 },
  mediaTypeBadge: { fontSize: 10, fontWeight: "700", color: "rgba(226,226,226,0.4)", letterSpacing: 1, marginTop: 3 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  deleteBtn: { fontSize: 13, color: "rgba(226,226,226,0.3)" },
  watchedAt: { fontSize: 11, color: "rgba(226,226,226,0.45)" },

  footerLoader: { paddingVertical: 20, alignItems: "center" },
  loadMoreBtn: {
    marginHorizontal: 16, marginVertical: 16, paddingVertical: 14,
    backgroundColor: "#1a1c1c", borderRadius: 8, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)", alignItems: "center",
  },
  loadMoreText: { fontSize: 12, fontWeight: "800", color: "rgba(226,226,226,0.5)", letterSpacing: 1.5 },

  fab: {
    position: "absolute", bottom: 24, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#e8002d", justifyContent: "center", alignItems: "center",
    shadowColor: "#e8002d", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: { fontSize: 28, color: "#fff", lineHeight: 32 },
});
