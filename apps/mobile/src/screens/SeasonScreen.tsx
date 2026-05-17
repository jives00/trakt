import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { EpisodeItem } from "../lib/api";

type Props = NativeStackScreenProps<SharedDetailParamList, "Season">;

export default function SeasonScreen({ route, navigation }: Props) {
  const { tmdbId, seasonNumber, showName } = route.params;
  const { token } = useAuth();
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<Set<number>>(new Set());

  async function load() {
    if (!token) return;
    return api.getSeason(tmdbId, seasonNumber, token).then((data) => {
      setEpisodes(data.episodes);
      setWatchedIds(new Set(data.watchedEpisodeIds));
    });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [tmdbId, seasonNumber, token]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function handleToggle(ep: EpisodeItem) {
    if (!token || toggling.has(ep.id)) return;
    setToggling((prev) => new Set(prev).add(ep.id));
    const wasWatched = watchedIds.has(ep.id);
    try {
      await api.toggleEpisodeWatched(tmdbId, seasonNumber, ep.episodeNumber, wasWatched, token);
      setWatchedIds((prev) => {
        const next = new Set(prev);
        wasWatched ? next.delete(ep.id) : next.add(ep.id);
        return next;
      });
    } finally {
      setToggling((prev) => { const next = new Set(prev); next.delete(ep.id); return next; });
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" /></View>;
  }

  const watchedCount = watchedIds.size;
  const total = episodes.length;

  return (
    <View style={s.root}>
      <FlatList
        data={episodes}
        keyExtractor={(ep) => String(ep.id)}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}
        ListHeaderComponent={
          <View style={s.header}>
            <Text style={s.headerTitle}>{showName}</Text>
            <Text style={s.headerSub}>Season {seasonNumber} · {watchedCount}/{total} watched</Text>
            {total > 0 && (
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${(watchedCount / total) * 100}%` }]} />
              </View>
            )}
          </View>
        }
        renderItem={({ item: ep }) => {
          const watched = watchedIds.has(ep.id);
          const loading = toggling.has(ep.id);
          return (
            <TouchableOpacity
              style={s.epRow}
              onPress={() => navigation.navigate("EpisodeDetail", {
                tmdbId, seasonNumber, episodeNumber: ep.episodeNumber, showName,
              })}
              activeOpacity={0.85}
            >
              <View style={s.stillContainer}>
                {ep.stillPath ? (
                  <Image source={{ uri: `${TMDB_IMG}w300${ep.stillPath}` }} style={s.still} contentFit="cover" />
                ) : (
                  <View style={[s.still, s.stillFallback]} />
                )}
                {watched && <View style={s.watchedOverlay}><Text style={s.watchedCheck}>✓</Text></View>}
              </View>
              <View style={s.epInfo}>
                <Text style={s.epCode}>E{String(ep.episodeNumber).padStart(2, "0")}</Text>
                <Text style={s.epTitle} numberOfLines={2}>{ep.title ?? `Episode ${ep.episodeNumber}`}</Text>
                {ep.runtimeMin ? <Text style={s.epMeta}>{ep.runtimeMin} min</Text> : null}
                {ep.airDate ? <Text style={s.epMeta}>{new Date(ep.airDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text> : null}
              </View>
              <TouchableOpacity
                style={[s.watchBtn, watched && s.watchBtnWatched]}
                onPress={() => handleToggle(ep)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={watched ? "#fff" : "#e8002d"} />
                ) : (
                  <Text style={[s.watchBtnText, watched && s.watchBtnTextWatched]}>{watched ? "✓" : "+"}</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1c1e26" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1c1e26" },

  header: { padding: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#f0f0f6" },
  headerSub: { fontSize: 12, color: "rgba(240,240,246,0.45)", marginTop: 4, marginBottom: 10 },
  progressTrack: { height: 3, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 3, backgroundColor: "#e8002d", borderRadius: 2 },

  epRow: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "#1e2029", borderRadius: 8, overflow: "hidden",
  },
  stillContainer: { position: "relative" },
  still: { width: 107, height: 60 },
  stillFallback: { backgroundColor: "#323440" },
  watchedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(232,0,45,0.7)",
    justifyContent: "center", alignItems: "center",
  },
  watchedCheck: { fontSize: 22, color: "#fff", fontWeight: "900" },
  epInfo: { flex: 1, padding: 10 },
  epCode: { fontSize: 11, fontWeight: "700", color: "#e8002d", marginBottom: 2 },
  epTitle: { fontSize: 13, fontWeight: "600", color: "#f0f0f6", lineHeight: 17 },
  epMeta: { fontSize: 10, color: "rgba(240,240,246,0.4)", marginTop: 3 },
  watchBtn: {
    width: 36, height: 36, borderRadius: 18, marginRight: 10,
    borderWidth: 2, borderColor: "#e8002d",
    justifyContent: "center", alignItems: "center",
  },
  watchBtnWatched: { backgroundColor: "#e8002d", borderColor: "#e8002d" },
  watchBtnText: { fontSize: 18, color: "#e8002d", lineHeight: 20 },
  watchBtnTextWatched: { color: "#fff" },
});
