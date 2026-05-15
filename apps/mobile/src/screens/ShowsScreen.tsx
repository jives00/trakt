import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { RootStackParamList } from "../navigation/types";
import type { ProgressItem } from "@trakt/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_W } = Dimensions.get("window");
const COLS = 3;
const GAP = 8;
const CARD_W = (SCREEN_W - GAP * (COLS + 1)) / COLS;

export default function ShowsScreen() {
  const { token } = useAuth();
  const nav = useNavigation<Nav>();
  const [shows, setShows] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.getProgress(token, "all")
      .then(setShows)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" size="large" /></View>;
  }

  return (
    <FlatList
      style={s.root}
      data={shows}
      keyExtractor={(item) => String(item.showId)}
      numColumns={COLS}
      contentContainerStyle={{ padding: GAP, gap: GAP, paddingBottom: 40 }}
      columnWrapperStyle={{ gap: GAP }}
      ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No shows yet.</Text></View>}
      renderItem={({ item }) => {
        const pct = item.totalEpisodes > 0 ? item.watchedEpisodes / item.totalEpisodes : 0;
        return (
          <TouchableOpacity
            style={s.card}
            onPress={() => nav.navigate("ShowDetail", { tmdbId: item.tmdbId })}
            activeOpacity={0.85}
          >
            {item.posterPath ? (
              <Image source={{ uri: `${TMDB_IMG}w185${item.posterPath}` }} style={s.poster} contentFit="cover" />
            ) : (
              <View style={[s.poster, s.posterFallback]} />
            )}
            {pct > 0 && (
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${pct * 100}%` }]} />
              </View>
            )}
            <Text style={s.title} numberOfLines={2}>{item.title}</Text>
          </TouchableOpacity>
        );
      }}
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
  progressTrack: { height: 3, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 0, overflow: "hidden", marginTop: -3 },
  progressFill: { height: 3, backgroundColor: "#e8002d" },
  title: { fontSize: 10, color: "#cccccc", marginTop: 5, lineHeight: 13 },
});
