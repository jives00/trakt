import { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl, ScrollView } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { ListDetail, ListItemEntry, ListSort } from "@trakt/types";

type Props = NativeStackScreenProps<SharedDetailParamList, "ListDetail">;

const SORT_OPTIONS: { id: ListSort; label: string }[] = [
  { id: "added_date", label: "Date Added" },
  { id: "alpha", label: "Aâ€“Z" },
  { id: "last_updated", label: "Last Updated" },
  { id: "random", label: "Random" },
];

function stripArticles(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, "").trim();
}

function sortItems(items: ListItemEntry[], sort: ListSort): ListItemEntry[] {
  const copy = [...items];
  if (sort === "alpha") {
    return copy.sort((a, b) => stripArticles(a.title ?? "").localeCompare(stripArticles(b.title ?? "")));
  }
  if (sort === "random") {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }
  return copy.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

export default function ListDetailScreen({ route, navigation }: Props) {
  const { listId, listName } = route.params;
  const { token } = useAuth();
  const [list, setList] = useState<ListDetail | null>(null);
  const [sortBy, setSortBy] = useState<ListSort>("added_date");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!token) return;
    return api.getList(listId, token).then((data) => {
      setList(data);
      setSortBy(data.defaultSort ?? "added_date");
    });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [listId, token]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function handleRemove(item: ListItemEntry) {
    if (!token || !list) return;
    Alert.alert("Remove from list?", `Remove "${item.title}" from ${listName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          if (!item.tmdbId) return;
          await api.removeListItem(listId, item.mediaType, item.mediaId, token);
          setList((prev) => prev ? { ...prev, items: prev.items.filter((i) => i.id !== item.id), itemCount: prev.itemCount - 1 } : null);
        },
      },
    ]);
  }

  function handlePress(item: ListItemEntry) {
    if (!item.tmdbId) return;
    if (item.mediaType === "movie") {
      navigation.navigate("MovieDetail", { tmdbId: item.tmdbId });
    } else {
      navigation.navigate("ShowDetail", { tmdbId: item.tmdbId });
    }
  }

  const sortedItems = useMemo(
    () => list ? sortItems(list.items, sortBy) : [],
    [list, sortBy],
  );

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" size="large" /></View>;
  }
  if (!list) {
    return <View style={s.center}><Text style={s.errorText}>Failed to load list.</Text></View>;
  }

  return (
    <FlatList
      style={s.root}
      data={sortedItems}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}
      ListHeaderComponent={
        <View>
          <View style={s.header}>
            {list.description ? <Text style={s.headerDesc}>{list.description}</Text> : null}
            <Text style={s.headerCount}>{list.itemCount} item{list.itemCount !== 1 ? "s" : ""}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortRow}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[s.sortPill, sortBy === opt.id && s.sortPillActive]}
                onPress={() => setSortBy(opt.id)}
              >
                <Text style={[s.sortPillText, sortBy === opt.id && s.sortPillTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>This list is empty.</Text></View>}
      renderItem={({ item }) => (
        <TouchableOpacity style={s.row} onPress={() => handlePress(item)} activeOpacity={0.85}>
          {item.posterPath ? (
            <Image source={{ uri: `${TMDB_IMG}w185${item.posterPath}` }} style={s.poster} contentFit="cover" />
          ) : (
            <View style={[s.poster, s.posterFallback]} />
          )}
          <View style={s.info}>
            <Text style={s.title} numberOfLines={1}>{item.title ?? "Unknown"}</Text>
            <Text style={s.sub}>
              {item.mediaType.toUpperCase()}{item.year ? ` Â· ${item.year}` : ""}
            </Text>
          </View>
          {!list.isSystem && (
            <TouchableOpacity
              style={s.removeBtn}
              onPress={() => handleRemove(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.removeBtnText}>âœ•</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1c1e26" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 40 },
  errorText: { color: "rgba(240,240,246,0.5)", fontSize: 15 },
  emptyText: { color: "rgba(240,240,246,0.4)", fontSize: 15 },

  header: { padding: 16, paddingBottom: 8 },
  headerDesc: { fontSize: 13, color: "rgba(240,240,246,0.55)", marginBottom: 6 },
  headerCount: { fontSize: 12, color: "rgba(240,240,246,0.35)", fontWeight: "600" },

  sortRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  sortPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#1e2029", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  sortPillActive: { backgroundColor: "#e8002d", borderColor: "#e8002d" },
  sortPillText: { fontSize: 12, color: "rgba(240,240,246,0.55)", fontWeight: "600" },
  sortPillTextActive: { color: "#fff" },

  row: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1e2029", borderRadius: 8, overflow: "hidden" },
  poster: { width: 46, height: 69, backgroundColor: "#323440" },
  posterFallback: { backgroundColor: "#323440" },
  info: { flex: 1, padding: 10 },
  title: { fontSize: 13, fontWeight: "700", color: "#f0f0f6", marginBottom: 3 },
  sub: { fontSize: 10, color: "rgba(240,240,246,0.4)", textTransform: "uppercase", letterSpacing: 0.5 },
  removeBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  removeBtnText: { fontSize: 14, color: "rgba(240,240,246,0.25)" },
});
