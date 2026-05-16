import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Dimensions, RefreshControl, Modal, FlatList } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SharedDetailParamList } from "../navigation/types";
import type { ShowDetail, ShowStatus, CastMember, SeasonSummary, ShowEpisodeSummary } from "../lib/api";
import type { UserList } from "@trakt/types";

type Props = NativeStackScreenProps<SharedDetailParamList, "ShowDetail">;

const { width: SCREEN_W } = Dimensions.get("window");
const SEASON_W = 90;
const CAST_W = 70;

export default function ShowDetailScreen({ route, navigation }: Props) {
  const { tmdbId } = route.params;
  const { token } = useAuth();
  const [show, setShow] = useState<ShowDetail | null>(null);
  const [status, setStatus] = useState<ShowStatus | null>(null);
  const [upNext, setUpNext] = useState<ShowEpisodeSummary | null>(null);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rating, setRating] = useState(0);
  const [listModal, setListModal] = useState(false);
  const [lists, setLists] = useState<UserList[]>([]);
  const [memberListIds, setMemberListIds] = useState<Set<number>>(new Set());

  async function load() {
    if (!token) return;
    return Promise.all([
      api.getShow(tmdbId, token),
      api.getShowUpNext(tmdbId, token),
      api.getShowSeasons(tmdbId, token),
      api.getShowCast(tmdbId, token),
    ]).then(([showData, upNextData, seasonsData, castData]) => {
      setShow(showData.show);
      setStatus(showData.status);
      setUpNext(upNextData.episode);
      setSeasons(seasonsData.seasons);
      setCast(castData.cast);
    });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [tmdbId, token]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function handleWatchlist() {
    if (!token || !status) return;
    const res = await api.toggleShowWatchlist(tmdbId, status.inWatchlist, token);
    setStatus((s) => s && { ...s, inWatchlist: res.inWatchlist });
  }

  async function handleDropped() {
    if (!token || !status) return;
    const res = await api.toggleShowDropped(tmdbId, token);
    setStatus((s) => s && { ...s, inDropped: res.inDropped });
  }

  async function handleRewatch() {
    if (!token || !status) return;
    const res = await api.toggleShowRewatch(tmdbId, token);
    setStatus((s) => s && { ...s, inRewatch: res.inRewatch });
  }

  async function openListPicker() {
    if (!token || !show) return;
    setListModal(true);
    const [listsRes, membershipRes] = await Promise.allSettled([
      api.getLists(token),
      api.getListMembership("show", show.id, token),
    ]);
    if (listsRes.status === "fulfilled") setLists(listsRes.value);
    if (membershipRes.status === "fulfilled") setMemberListIds(new Set(membershipRes.value.listIds));
  }

  async function toggleList(list: UserList) {
    if (!token || !show) return;
    if (memberListIds.has(list.id)) {
      await api.removeListItem(list.id, "show", show.id, token).catch(() => {});
      setMemberListIds((prev) => { const next = new Set(prev); next.delete(list.id); return next; });
    } else {
      await api.addListItem(list.id, "show", show.id, token).catch(() => {});
      setMemberListIds((prev) => new Set([...prev, list.id]));
    }
  }

  async function handleRate(r: number) {
    if (!token) return;
    setRating(r);
    await api.upsertRating("show", tmdbId, r, token).catch(() => {});
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" size="large" /></View>;
  }
  if (!show || !status) {
    return <View style={s.center}><Text style={s.errorText}>Failed to load show.</Text></View>;
  }

  const backdropUrl = show.backdropPath ? `${TMDB_IMG}original${show.backdropPath}` : null;
  const regulars = cast.filter((m) => m.isRegular).slice(0, 20);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}>
      {/* Hero */}
      <View style={s.hero}>
        {backdropUrl && (
          <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        )}
        <View style={s.heroOverlay} />
        <View style={s.heroContent}>
          <View style={s.genreRow}>
            {show.genres.slice(0, 3).map((g) => (
              <View key={g} style={s.genreBadge}>
                <Text style={s.genreText}>{g}</Text>
              </View>
            ))}
          </View>
          <Text style={s.heroTitle}>{show.title}</Text>
          {show.overview ? (
            <Text style={s.heroOverview} numberOfLines={3}>{show.overview}</Text>
          ) : null}
        </View>
      </View>

      {/* Action buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={[s.actionBtn, status.inWatchlist && s.actionBtnActive]}
          onPress={handleWatchlist}
        >
          <Text style={s.actionBtnIcon}>ðŸ”–</Text>
          <Text style={[s.actionBtnText, status.inWatchlist && s.actionBtnTextActive]}>
            {status.inWatchlist ? "Watchlisted" : "Watchlist"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, status.inDropped && s.actionBtnActive]}
          onPress={handleDropped}
        >
          <Text style={s.actionBtnIcon}>ðŸš«</Text>
          <Text style={[s.actionBtnText, status.inDropped && s.actionBtnTextActive]}>
            {status.inDropped ? "Dropped" : "Drop"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, status.inRewatch && s.actionBtnActive]}
          onPress={handleRewatch}
        >
          <Text style={s.actionBtnIcon}>ðŸ”</Text>
          <Text style={[s.actionBtnText, status.inRewatch && s.actionBtnTextActive]}>
            {status.inRewatch ? "Rewatching" : "Rewatch"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={openListPicker}>
          <Text style={s.actionBtnIcon}>â˜°</Text>
          <Text style={s.actionBtnText}>Lists</Text>
        </TouchableOpacity>
      </View>

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
                  {memberListIds.has(item.id) && <Text style={s.listCheckMark}>âœ“</Text>}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Metadata */}
      <View style={s.metaGrid}>
        {show.status ? <MetaItem label="Status" value={show.status} accent /> : null}
        {show.network ? <MetaItem label="Network" value={show.network} /> : null}
        {show.firstAirDate ? <MetaItem label="Premiered" value={new Date(show.firstAirDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} /> : null}
        {show.runtimeMin ? <MetaItem label="Runtime" value={`${show.runtimeMin} min`} /> : null}
        {show.tmdbRating != null ? <MetaItem label="TMDB" value={`${(show.tmdbRating / 10).toFixed(1)}/10`} /> : null}
      </View>

      {/* Up Next */}
      {upNext && (
        <Section title="Up Next">
          <TouchableOpacity
            style={s.upNextCard}
            onPress={() => navigation.navigate("EpisodeDetail", {
              tmdbId, seasonNumber: upNext.seasonNumber, episodeNumber: upNext.episodeNumber, showName: show.title,
            })}
          >
            {upNext.stillPath && (
              <Image source={{ uri: `${TMDB_IMG}w300${upNext.stillPath}` }} style={s.upNextStill} contentFit="cover" />
            )}
            <View style={s.upNextInfo}>
              <Text style={s.upNextCode}>S{String(upNext.seasonNumber).padStart(2, "0")} E{String(upNext.episodeNumber).padStart(2, "0")}</Text>
              <Text style={s.upNextTitle} numberOfLines={2}>{upNext.title ?? `Episode ${upNext.episodeNumber}`}</Text>
              {upNext.runtimeMin ? <Text style={s.upNextMeta}>{upNext.runtimeMin}m</Text> : null}
            </View>
          </TouchableOpacity>
        </Section>
      )}

      {/* Rating */}
      <Section title="My Rating">
        <View style={s.ratingRow}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
            <TouchableOpacity key={star} onPress={() => handleRate(star)} style={s.starBtn}>
              <Text style={[s.star, star <= rating && s.starActive]}>â˜…</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* Seasons */}
      {seasons.length > 0 && (
        <Section title="Seasons">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {seasons.map((season) => (
              <TouchableOpacity
                key={season.seasonNumber}
                style={{ width: SEASON_W }}
                onPress={() => navigation.navigate("Season", { tmdbId, seasonNumber: season.seasonNumber, showName: show.title })}
              >
                {season.posterPath ? (
                  <Image source={{ uri: `${TMDB_IMG}w185${season.posterPath}` }} style={s.seasonPoster} contentFit="cover" />
                ) : (
                  <View style={[s.seasonPoster, s.posterFallback]} />
                )}
                <Text style={s.seasonLabel} numberOfLines={1}>Season {season.seasonNumber}</Text>
                <Text style={s.seasonMeta}>{season.episodeCount} eps</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Section>
      )}

      {/* Cast */}
      {regulars.length > 0 && (
        <Section title="Series Regulars">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {regulars.map((m) => (
              <TouchableOpacity
                key={m.tmdbId}
                style={{ width: CAST_W }}
                onPress={() => Linking.openURL(`https://www.themoviedb.org/person/${m.tmdbId}`)}
              >
                {m.profilePath ? (
                  <Image source={{ uri: `${TMDB_IMG}w185${m.profilePath}` }} style={s.castPhoto} contentFit="cover" />
                ) : (
                  <View style={[s.castPhoto, s.posterFallback]} />
                )}
                <Text style={s.castName} numberOfLines={2}>{m.name}</Text>
                <Text style={s.castChar} numberOfLines={1}>{m.character}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Section>
      )}

      {/* Links */}
      <Section title="Links">
        <View style={s.linkRow}>
          <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(`https://www.themoviedb.org/tv/${tmdbId}`)}>
            <Text style={s.linkText}>TMDB</Text>
          </TouchableOpacity>
          {show.imdbId && (
            <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(`https://www.imdb.com/title/${show.imdbId}/`)}>
              <Text style={s.linkText}>IMDb</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(`https://trakt.tv/search?q=${encodeURIComponent(show.title)}&type=show`)}>
            <Text style={s.linkText}>Trakt.tv</Text>
          </TouchableOpacity>
        </View>
      </Section>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MetaItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.metaItem}>
      <Text style={s.metaLabel}>{label.toUpperCase()}</Text>
      <Text style={[s.metaValue, accent && s.metaValueAccent]}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={s.sectionAccent} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1c1e26" },
  content: { flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1c1e26" },
  errorText: { color: "rgba(240,240,246,0.5)", fontSize: 15 },

  hero: { height: 280, backgroundColor: "#12141b", justifyContent: "flex-end" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  heroContent: { padding: 20, paddingBottom: 24 },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  genreBadge: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  genreText: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  heroTitle: { fontSize: 26, fontWeight: "900", color: "#fff", marginBottom: 8 },
  heroOverview: { fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 19 },

  actionRow: { flexDirection: "row", gap: 8, padding: 16 },
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
  metaValueAccent: { color: "#e8002d" },

  section: { paddingTop: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  sectionAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: "#e8002d" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#f0f0f6", letterSpacing: -0.2 },

  upNextCard: { flexDirection: "row", marginHorizontal: 16, backgroundColor: "#1e2029", borderRadius: 8, overflow: "hidden" },
  upNextStill: { width: 120, height: 68 },
  upNextInfo: { flex: 1, padding: 10 },
  upNextCode: { fontSize: 11, fontWeight: "700", color: "#e8002d", marginBottom: 3 },
  upNextTitle: { fontSize: 13, fontWeight: "600", color: "#f0f0f6" },
  upNextMeta: { fontSize: 10, color: "rgba(240,240,246,0.4)", marginTop: 4 },

  ratingRow: { flexDirection: "row", paddingHorizontal: 16, gap: 4 },
  starBtn: { padding: 4 },
  star: { fontSize: 24, color: "rgba(240,240,246,0.2)" },
  starActive: { color: "#e8002d" },

  seasonPoster: { width: SEASON_W, height: SEASON_W * 1.5, borderRadius: 6, backgroundColor: "#323440" },
  posterFallback: { backgroundColor: "#323440" },
  seasonLabel: { fontSize: 11, color: "#d7d8e2", marginTop: 5 },
  seasonMeta: { fontSize: 10, color: "#888", marginTop: 1 },

  castPhoto: { width: CAST_W, height: CAST_W * 1.5, borderRadius: 6, backgroundColor: "#323440" },
  castName: { fontSize: 10, color: "#d7d8e2", marginTop: 4, lineHeight: 13 },
  castChar: { fontSize: 9, color: "#888", marginTop: 1 },

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
