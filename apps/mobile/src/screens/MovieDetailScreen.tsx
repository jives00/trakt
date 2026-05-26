﻿﻿import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, RefreshControl, Modal, FlatList } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { MovieDetail, MovieStatus, MovieCastMember, HistoryItem } from "../lib/api";
import type { UserList } from "@trakt/types";
import { Ionicons } from "@expo/vector-icons";
import { WatchActionSheet } from "../components/WatchActionSheet";

type Props = NativeStackScreenProps<SharedDetailParamList, "MovieDetail">;

export default function MovieDetailScreen({ route }: Props) {
  const { tmdbId } = route.params;
  const { token } = useAuth();
  const [movie, setMovie] = useState<(MovieDetail & { id: number }) | null>(null);
  const [status, setStatus] = useState<MovieStatus | null>(null);
  const [cast, setCast] = useState<MovieCastMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [watchSheet, setWatchSheet] = useState(false);
  const [rating, setRating] = useState(0);
  const [listModal, setListModal] = useState(false);
  const [lists, setLists] = useState<UserList[]>([]);
  const [memberListIds, setMemberListIds] = useState<Set<number>>(new Set());

  async function load() {
    if (!token) return;
    return Promise.all([
      api.getMovie(tmdbId, token),
      api.getMovieCast(tmdbId, token),
      api.getMovieHistory(tmdbId, token).catch(() => [] as HistoryItem[]),
    ]).then(([movieData, castData, historyData]) => {
      setMovie(movieData.movie);
      setStatus(movieData.status);
      setCast(castData.cast.slice(0, 20));
      setHistory(historyData);
    });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [tmdbId, token]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function handleMarkWatched(watchedAt: string) {
    if (!token || toggling) return;
    setToggling(true);
    try {
      const res = await api.toggleMovieWatched(tmdbId, false, token, watchedAt);
      setStatus((s) => s && { ...s, watched: res.watched });
      api.getMovieHistory(tmdbId, token).then(setHistory).catch(() => {});
    } finally {
      setToggling(false);
    }
  }

  async function handleRemoveLatest(id: number) {
    if (!token) return;
    await api.deleteHistory(id, token).catch(() => {});
    const [historyData] = await Promise.all([api.getMovieHistory(tmdbId, token).catch(() => [] as HistoryItem[])]);
    setHistory(historyData);
    if (historyData.length === 0) setStatus((s) => s && { ...s, watched: false });
  }

  async function handleRemoveAll() {
    if (!token || !status) return;
    const res = await api.toggleMovieWatched(tmdbId, true, token);
    setStatus((s) => s && { ...s, watched: res.watched });
    setHistory([]);
  }

  async function handleWatchlist() {
    if (!token || !status) return;
    const res = await api.toggleMovieWatchlist(tmdbId, status.inWatchlist, token);
    setStatus((s) => s && { ...s, inWatchlist: res.inWatchlist });
  }

  async function openListPicker() {
    if (!token || !movie) return;
    setListModal(true);
    const [listsRes, membershipRes] = await Promise.allSettled([
      api.getLists(token),
      api.getListMembership("movie", movie.id, token),
    ]);
    if (listsRes.status === "fulfilled") setLists(listsRes.value);
    if (membershipRes.status === "fulfilled") setMemberListIds(new Set(membershipRes.value.listIds));
  }

  async function toggleList(list: UserList) {
    if (!token || !movie) return;
    if (memberListIds.has(list.id)) {
      await api.removeListItem(list.id, "movie", movie.id, token).catch(() => {});
      setMemberListIds((prev) => { const next = new Set(prev); next.delete(list.id); return next; });
    } else {
      await api.addListItem(list.id, "movie", movie.id, token).catch(() => {});
      setMemberListIds((prev) => new Set([...prev, list.id]));
    }
  }

  async function handleRate(r: number) {
    if (!token) return;
    setRating(r);
    await api.upsertRating("movie", tmdbId, r, token).catch(() => {});
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" size="large" /></View>;
  }
  if (!movie || !status) {
    return <View style={s.center}><Text style={s.errorText}>Failed to load movie.</Text></View>;
  }

  const backdropUrl = movie.backdropPath ? `${TMDB_IMG}original${movie.backdropPath}` : null;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}>
      {/* Hero */}
      <View style={s.hero}>
        {backdropUrl && (
          <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        )}
      </View>

      {/* Title / genre / overview */}
      <View style={s.heroContent}>
        <View style={s.genreRow}>
          {movie.genres.slice(0, 3).map((g) => (
            <View key={g} style={s.genreBadge}>
              <Text style={s.genreText}>{g}</Text>
            </View>
          ))}
        </View>
        <Text style={s.heroTitle}>{movie.title}</Text>
        {movie.overview ? (
          <Text style={s.heroOverview}>{movie.overview}</Text>
        ) : null}
      </View>

      {/* Action buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={[s.actionBtn, status.watched && s.actionBtnActive]}
          onPress={() => setWatchSheet(true)}
          disabled={toggling}
        >
          {toggling ? (
            <ActivityIndicator size="small" color={status.watched ? "#fff" : "#e8002d"} />
          ) : (
            <>
              <Text style={s.actionBtnIcon}>{status.watched ? "✓" : "▷"}</Text>
              <Text style={[s.actionBtnText, status.watched && s.actionBtnTextActive]}>
                {status.watched ? "Watched" : "Watch"}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, status.inWatchlist && s.actionBtnActive]}
          onPress={handleWatchlist}
        >
          <Ionicons name={status.inWatchlist ? "bookmark" : "bookmark-outline"} size={18} color={status.inWatchlist ? "#fff" : "#f0f0f6"} />
          <Text style={[s.actionBtnText, status.inWatchlist && s.actionBtnTextActive]}>
            {status.inWatchlist ? "Watchlisted" : "Watchlist"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={openListPicker}>
          <Ionicons name="list-outline" size={18} color="#f0f0f6" />
          <Text style={s.actionBtnText}>Lists</Text>
        </TouchableOpacity>
      </View>

      <WatchActionSheet
        visible={watchSheet}
        onClose={() => setWatchSheet(false)}
        watched={status.watched}
        releaseDate={movie.releaseDate ?? null}
        onMark={handleMarkWatched}
        onRemoveLatest={handleRemoveLatest}
        onRemoveAll={handleRemoveAll}
        latestEntryId={history[0]?.id ?? null}
      />

      {/* List picker modal */}
      <Modal visible={listModal} transparent animationType="slide" onRequestClose={() => setListModal(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setListModal(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Add to List</Text>
          <FlatList
            data={lists}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.listRow} onPress={() => toggleList(item)}>
                <Text style={s.listRowName}>{item.name}</Text>
                <View style={[s.listCheck, memberListIds.has(item.id) && s.listCheckActive]}>
                  {memberListIds.has(item.id) && <Text style={s.listCheckMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Metadata */}
      <View style={s.metaGrid}>
        {movie.releaseDate ? <MetaItem label="Released" value={new Date(movie.releaseDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} /> : null}
        {movie.runtimeMin ? <MetaItem label="Runtime" value={`${movie.runtimeMin} min`} /> : null}
        {movie.tmdbRating != null ? <MetaItem label="TMDB" value={`${(movie.tmdbRating / 10).toFixed(1)}/10`} /> : null}
        {movie.rtCriticScore != null ? <MetaItem label="IMDb" value={`${(movie.rtCriticScore / 10).toFixed(1)}/10`} /> : null}
        {movie.originalLanguage ? <MetaItem label="Language" value={movie.originalLanguage.toUpperCase()} /> : null}
      </View>

      {/* Rating */}
      <View style={s.ratingSection}>
        <View style={s.sectionHeader}>
          <View style={s.sectionAccent} />
          <Text style={s.sectionTitle}>My Rating</Text>
        </View>
        <View style={s.ratingRow}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
            <TouchableOpacity key={star} onPress={() => handleRate(star)} style={s.starBtn}>
              <Text style={[s.star, star <= rating && s.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Cast */}
      {cast.length > 0 && (
        <View style={s.castSection}>
          <View style={s.sectionHeader}>
            <View style={s.sectionAccent} />
            <Text style={s.sectionTitle}>Cast</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {cast.map((m) => (
              <TouchableOpacity
                key={m.tmdbId}
                style={s.castCard}
                onPress={() => Linking.openURL(`https://www.themoviedb.org/person/${m.tmdbId}`)}
              >
                {m.profilePath ? (
                  <Image source={{ uri: `${TMDB_IMG}w185${m.profilePath}` }} style={s.castPhoto} contentFit="cover" />
                ) : (
                  <View style={[s.castPhoto, s.castFallback]} />
                )}
                <Text style={s.castName} numberOfLines={2}>{m.name}</Text>
                <Text style={s.castChar} numberOfLines={1}>{m.character}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Links */}
      <View style={s.linkSection}>
        <View style={s.sectionHeader}>
          <View style={s.sectionAccent} />
          <Text style={s.sectionTitle}>Links</Text>
        </View>
        <View style={s.linkRow}>
          <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(`https://www.themoviedb.org/movie/${tmdbId}`)}>
            <Text style={s.linkText}>TMDB</Text>
          </TouchableOpacity>
          {movie.imdbId && (
            <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(`https://www.imdb.com/title/${movie.imdbId}/`)}>
              <Text style={s.linkText}>IMDb</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(`https://trakt.tv/search?q=${encodeURIComponent(movie.title)}&type=movie`)}>
            <Text style={s.linkText}>Trakt.tv</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metaItem}>
      <Text style={s.metaLabel}>{label.toUpperCase()}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1c1e26" },
  content: { flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1c1e26" },
  errorText: { color: "rgba(240,240,246,0.5)", fontSize: 15 },

  hero: { height: 280, backgroundColor: "#12141b" },
  heroContent: { padding: 20, paddingBottom: 8, backgroundColor: "#12141b" },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  genreBadge: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  genreText: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  heroTitle: { fontSize: 26, fontWeight: "900", color: "#fff", marginBottom: 8 },
  heroOverview: { fontSize: 13, color: "rgba(240,240,246,0.75)", lineHeight: 20 },

  actionRow: { flexDirection: "row", gap: 10, padding: 16 },
  actionBtn: {
    flex: 1, flexDirection: "column", alignItems: "center", gap: 4,
    paddingVertical: 12, borderRadius: 10,
    backgroundColor: "#1e2029", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  actionBtnActive: { backgroundColor: "#e8002d", borderColor: "#e8002d" },
  actionBtnIcon: { fontSize: 18 },
  actionBtnText: { fontSize: 10, fontWeight: "700", color: "rgba(240,240,246,0.6)", textTransform: "uppercase", letterSpacing: 0.5 },
  actionBtnTextActive: { color: "#fff" },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 16, paddingBottom: 8 },
  metaItem: { minWidth: "40%" },
  metaLabel: { fontSize: 9, fontWeight: "900", color: "rgba(240,240,246,0.35)", letterSpacing: 1.5, marginBottom: 3 },
  metaValue: { fontSize: 14, color: "#f0f0f6", fontWeight: "600" },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  sectionAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: "#e8002d" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#f0f0f6", letterSpacing: -0.2 },

  ratingSection: { paddingTop: 24 },
  ratingRow: { flexDirection: "row", paddingHorizontal: 16, gap: 4 },
  starBtn: { padding: 4 },
  star: { fontSize: 24, color: "rgba(240,240,246,0.2)" },
  starActive: { color: "#e8002d" },

  castSection: { paddingTop: 24 },
  castCard: { width: 70 },
  castPhoto: { width: 70, height: 105, borderRadius: 6, backgroundColor: "#323440" },
  castFallback: { backgroundColor: "#323440" },
  castName: { fontSize: 10, color: "#d7d8e2", marginTop: 4, lineHeight: 13 },
  castChar: { fontSize: 11, color: "#888", marginTop: 1 },

  linkSection: { paddingTop: 24 },
  linkRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  linkBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#1e2029" },
  linkText: { fontSize: 11, fontWeight: "700", color: "rgba(240,240,246,0.55)", letterSpacing: 0.5 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: { backgroundColor: "#1e2029", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: "70%" },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginTop: 10, marginBottom: 4 },
  modalTitle: { fontSize: 15, fontWeight: "800", color: "#f0f0f6", paddingHorizontal: 20, paddingVertical: 14 },
  listRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  listRowName: { fontSize: 15, color: "#f0f0f6", flex: 1 },
  listCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  listCheckActive: { backgroundColor: "#e8002d", borderColor: "#e8002d" },
  listCheckMark: { fontSize: 13, color: "#fff", fontWeight: "700" },
});
