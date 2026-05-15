import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { RootStackParamList } from "../navigation/types";
import type { EpisodeDetail, CastMember } from "../lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "EpisodeDetail">;

export default function EpisodeDetailScreen({ route }: Props) {
  const { tmdbId, seasonNumber, episodeNumber, showName } = route.params;
  const { token } = useAuth();
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [watched, setWatched] = useState(false);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.getEpisode(tmdbId, seasonNumber, episodeNumber, token),
      api.getEpisodeCast(tmdbId, seasonNumber, episodeNumber, token),
    ])
      .then(([epData, castData]) => {
        setEpisode(epData.episode);
        setWatched(epData.watched);
        setCast(castData.cast.slice(0, 12));
      })
      .finally(() => setLoading(false));
  }, [tmdbId, seasonNumber, episodeNumber, token]);

  async function handleToggle() {
    if (!token || toggling) return;
    setToggling(true);
    try {
      await api.toggleEpisodeWatched(tmdbId, seasonNumber, episodeNumber, watched, token);
      setWatched(!watched);
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" size="large" /></View>;
  }
  if (!episode) {
    return <View style={s.center}><Text style={s.errorText}>Failed to load episode.</Text></View>;
  }

  const stillUrl = episode.stillPath ? `${TMDB_IMG}w780${episode.stillPath}` : null;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Still */}
      <View style={s.stillContainer}>
        {stillUrl ? (
          <Image source={{ uri: stillUrl }} style={s.still} contentFit="cover" />
        ) : (
          <View style={[s.still, s.stillFallback]} />
        )}
        <View style={s.stillOverlay} />
      </View>

      <View style={s.body}>
        <Text style={s.showName}>{showName}</Text>
        <Text style={s.epCode}>
          S{String(seasonNumber).padStart(2, "0")} · E{String(episodeNumber).padStart(2, "0")}
          {episode.runtimeMin ? ` · ${episode.runtimeMin}m` : ""}
        </Text>
        <Text style={s.epTitle}>{episode.title ?? `Episode ${episodeNumber}`}</Text>

        {episode.airDate ? (
          <Text style={s.airDate}>
            {new Date(episode.airDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </Text>
        ) : null}

        {episode.overview ? (
          <Text style={s.overview}>{episode.overview}</Text>
        ) : null}

        {/* Watched toggle */}
        <TouchableOpacity
          style={[s.watchedBtn, watched && s.watchedBtnActive]}
          onPress={handleToggle}
          disabled={toggling}
        >
          {toggling ? (
            <ActivityIndicator size="small" color={watched ? "#fff" : "#e8002d"} />
          ) : (
            <Text style={[s.watchedBtnText, watched && s.watchedBtnTextActive]}>
              {watched ? "✓ Watched" : "Mark as Watched"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Ratings */}
        {(episode.tmdbRating != null || episode.rtCriticScore != null) && (
          <View style={s.ratingsRow}>
            {episode.tmdbRating != null && (
              <View style={s.ratingChip}>
                <Text style={s.ratingLabel}>TMDB</Text>
                <Text style={s.ratingValue}>{(episode.tmdbRating / 10).toFixed(1)}</Text>
              </View>
            )}
            {episode.rtCriticScore != null && (
              <View style={s.ratingChip}>
                <Text style={s.ratingLabel}>IMDb</Text>
                <Text style={s.ratingValue}>{(episode.rtCriticScore / 10).toFixed(1)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Guest cast */}
        {cast.length > 0 && (
          <View style={s.castSection}>
            <Text style={s.castHeading}>GUEST CAST</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {cast.map((m) => (
                <View key={m.tmdbId} style={s.castCard}>
                  {m.profilePath ? (
                    <Image source={{ uri: `${TMDB_IMG}w185${m.profilePath}` }} style={s.castPhoto} contentFit="cover" />
                  ) : (
                    <View style={[s.castPhoto, s.stillFallback]} />
                  )}
                  <Text style={s.castName} numberOfLines={2}>{m.name}</Text>
                  <Text style={s.castChar} numberOfLines={1}>{m.character}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1d1d1d" },
  content: { flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1d1d1d" },
  errorText: { color: "rgba(226,226,226,0.5)", fontSize: 15 },

  stillContainer: { position: "relative" },
  still: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#282a2b" },
  stillFallback: { backgroundColor: "#282a2b" },
  stillOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: "rgba(29,29,29,0.5)" },

  body: { padding: 20 },
  showName: { fontSize: 13, color: "rgba(226,226,226,0.5)", fontWeight: "600", marginBottom: 4 },
  epCode: { fontSize: 12, color: "#e8002d", fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  epTitle: { fontSize: 22, fontWeight: "900", color: "#e2e2e2", marginBottom: 6 },
  airDate: { fontSize: 12, color: "rgba(226,226,226,0.4)", marginBottom: 16 },
  overview: { fontSize: 14, color: "rgba(226,226,226,0.75)", lineHeight: 22, marginBottom: 24 },

  watchedBtn: {
    paddingVertical: 14, borderRadius: 10, alignItems: "center",
    borderWidth: 2, borderColor: "#e8002d", marginBottom: 20,
  },
  watchedBtnActive: { backgroundColor: "#e8002d" },
  watchedBtnText: { fontSize: 14, fontWeight: "700", color: "#e8002d" },
  watchedBtnTextActive: { color: "#fff" },

  ratingsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  ratingChip: { alignItems: "center", backgroundColor: "#1a1c1c", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  ratingLabel: { fontSize: 9, color: "rgba(226,226,226,0.35)", fontWeight: "800", letterSpacing: 1.5 },
  ratingValue: { fontSize: 18, color: "#e2e2e2", fontWeight: "900" },

  castSection: { marginTop: 8 },
  castHeading: { fontSize: 10, fontWeight: "900", color: "rgba(226,226,226,0.35)", letterSpacing: 2, marginBottom: 12 },
  castCard: { width: 70 },
  castPhoto: { width: 70, height: 105, borderRadius: 6, backgroundColor: "#282a2b" },
  castName: { fontSize: 10, color: "#cccccc", marginTop: 4, lineHeight: 13 },
  castChar: { fontSize: 9, color: "#888", marginTop: 1 },
});
