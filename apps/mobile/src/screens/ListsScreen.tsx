import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ImageBackground, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { UserList } from "@trakt/types";

type Nav = NativeStackNavigationProp<SharedDetailParamList>;

const TYPE_LABEL: Record<string, string> = {
  watchlist: "Watchlist",
  dropped: "Dropped",
  rewatch: "Rewatch",
  custom: "Custom",
};

export default function ListsScreen() {
  const { token } = useAuth();
  const nav = useNavigation<Nav>();
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!token) return;
    return api.getLists(token).then(setLists);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [token]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" size="large" /></View>;
  }

  return (
    <FlatList
      style={s.root}
      data={lists}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}
      keyExtractor={(l) => String(l.id)}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No lists yet.</Text></View>}
      renderItem={({ item: list }) => {
        const backdrop = list.previewBackdrops[0];
        const backdropUri = backdrop ? `${TMDB_IMG}w780${backdrop}` : null;
        return (
          <TouchableOpacity
            style={s.card}
            onPress={() => nav.navigate("ListDetail", { listId: list.id, listName: list.name })}
            activeOpacity={0.85}
          >
            {backdropUri ? (
              <Image source={{ uri: backdropUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : null}
            <View style={s.cardOverlay} />
            <View style={s.cardContent}>
              <View style={s.cardTop}>
                <View style={s.typeBadge}>
                  <Text style={s.typeText}>{TYPE_LABEL[list.listType] ?? list.listType}</Text>
                </View>
                {!!list.isPublic && <View style={s.publicBadge}><Text style={s.publicText}>PUBLIC</Text></View>}
              </View>
              <Text style={s.cardTitle}>{list.name}</Text>
              {list.description ? <Text style={s.cardDesc} numberOfLines={1}>{list.description}</Text> : null}
              <Text style={s.cardCount}>{list.itemCount} item{list.itemCount !== 1 ? "s" : ""}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1c1e26" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "rgba(240,240,246,0.4)", fontSize: 15 },

  card: { height: 110, borderRadius: 10, overflow: "hidden", backgroundColor: "#1e2029", justifyContent: "flex-end" },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  cardContent: { padding: 14 },
  cardTop: { flexDirection: "row", gap: 8, marginBottom: 6 },
  typeBadge: { backgroundColor: "rgba(232,0,45,0.8)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typeText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  publicBadge: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  publicText: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.7)", letterSpacing: 1 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 2 },
  cardDesc: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 },
  cardCount: { fontSize: 10, color: "rgba(255,255,255,0.45)" },
});
