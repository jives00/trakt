import { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { ListDetail, ListItemEntry } from "@trakt/types";
import { Ionicons } from "@expo/vector-icons";
import {
  ListFilterBar, filterItems, SORT_OPTIONS,
  type ListSortOption, type MediaFilter, type ReleaseFilter, type StatusFilter,
} from "../components/ListFilterBar";

type Props = NativeStackScreenProps<SharedDetailParamList, "ListDetail">;

function stripArticles(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, "").trim();
}

function sortItems(items: ListItemEntry[], sort: ListSortOption): ListItemEntry[] {
  const copy = [...items];
  if (sort === "alpha") {
    return copy.sort((a, b) => stripArticles(a.title ?? "").localeCompare(stripArticles(b.title ?? "")));
  }
  return copy.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

export default function ListDetailScreen({ route, navigation }: Props) {
  const { listId, listName } = route.params;
  const { token } = useAuth();
  const [list, setList] = useState<ListDetail | null>(null);
  const [sortBy, setSortBy] = useState<ListSortOption>("added_date");
  const [media, setMedia] = useState<MediaFilter>("all");
  const [release, setRelease] = useState<ReleaseFilter>("all");
  const [status, setStatus] = useState<StatusFilter | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!token) return;
    return api.getList(listId, token).then((data) => {
      setList(data);
      const saved = SORT_OPTIONS.find((o) => o.id === data.defaultSort);
      setSortBy(saved ? saved.id : "added_date");
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
    () => list ? sortItems(filterItems(list.items, media, release, status), sortBy) : [],
    [list, sortBy, media, release, status],
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
          {list.items.length > 0 && (
            <ListFilterBar
              sort={sortBy} onSort={setSortBy}
              media={media} onMedia={setMedia}
              release={release} onRelease={setRelease}
              status={status} onStatus={setStatus}
            />
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={s.center}>
          <Text style={s.emptyText}>{list.items.length === 0 ? "This list is empty." : "No items match this filter."}</Text>
        </View>
      }
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
              {item.mediaType.toUpperCase()}{item.year ? ` · ${item.year}` : ""}
            </Text>
          </View>
          {!list.isSystem && (
            <TouchableOpacity
              style={s.removeBtn}
              onPress={() => handleRemove(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color="rgba(240,240,246,0.4)" />
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

  row: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1e2029", borderRadius: 8, overflow: "hidden" },
  poster: { width: 46, height: 69, backgroundColor: "#323440" },
  posterFallback: { backgroundColor: "#323440" },
  info: { flex: 1, padding: 10 },
  title: { fontSize: 13, fontWeight: "700", color: "#f0f0f6", marginBottom: 3 },
  sub: { fontSize: 10, color: "rgba(240,240,246,0.4)", textTransform: "uppercase", letterSpacing: 0.5 },
  removeBtn: { paddingHorizontal: 14, paddingVertical: 10 },
});
