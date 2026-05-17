import { useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Keyboard, Alert } from "react-native";
import { Image } from "expo-image";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { SearchResult } from "@trakt/types";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Step = "search" | "confirm";

export default function ManualScrobbleModal({ visible, onClose }: Props) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("search");
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSearch() {
    if (!query.trim() || !token) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      const data = await api.search(query.trim(), token);
      setResults(data.slice(0, 20));
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(item: SearchResult) {
    setSelected(item);
    setStep("confirm");
  }

  async function handleConfirm() {
    if (!token || !selected) return;
    setSubmitting(true);
    try {
      if (selected.mediaType === "movie") {
        await api.toggleMovieWatched(selected.tmdbId, false, token);
      } else {
        Alert.alert("Mark Show Watched", "This will mark the entire show as watched.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: async () => {
              await api.toggleShowWatched(selected.tmdbId, false, token);
              handleClose();
            },
          },
        ]);
        return;
      }
      handleClose();
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setQuery("");
    setResults([]);
    setStep("search");
    setSelected(null);
    onClose();
  }

  function handleBack() {
    setStep("search");
    setSelected(null);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          {step === "confirm" ? (
            <TouchableOpacity onPress={handleBack} style={s.backBtn}>
              <Text style={s.backBtnText}>‹ Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
          <Text style={s.headerTitle}>Log Watch</Text>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <Ionicons name="close" size={16} color="rgba(240,240,246,0.4)" />
          </TouchableOpacity>
        </View>

        {step === "search" ? (
          <>
            {/* Search bar */}
            <View style={s.searchRow}>
              <TextInput
                style={s.input}
                placeholder="Search movies or shows…"
                placeholderTextColor="rgba(240,240,246,0.3)"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus
              />
              <TouchableOpacity style={s.searchBtn} onPress={handleSearch}>
                <Text style={s.searchBtnText}>Search</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={s.center}><ActivityIndicator color="#e8002d" /></View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListEmptyComponent={
                  query.length > 0 && !loading ? (
                    <View style={s.center}><Text style={s.emptyText}>Search for a title above.</Text></View>
                  ) : null
                }
                renderItem={({ item }) => {
                  const posterUrl = item.posterPath ? `${TMDB_IMG}w185${item.posterPath}` : null;
                  return (
                    <TouchableOpacity style={s.resultRow} onPress={() => handleSelect(item)} activeOpacity={0.85}>
                      {posterUrl ? (
                        <Image source={{ uri: posterUrl }} style={s.resultPoster} contentFit="cover" />
                      ) : (
                        <View style={[s.resultPoster, s.posterFallback]} />
                      )}
                      <View style={s.resultInfo}>
                        <Text style={s.resultTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={s.resultMeta}>
                          {item.mediaType === "movie" ? "MOVIE" : "SHOW"}{item.year ? ` · ${item.year}` : ""}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#e8002d" />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </>
        ) : (
          /* Confirm step */
          <View style={s.confirmStep}>
            {selected?.posterPath ? (
              <Image source={{ uri: `${TMDB_IMG}w342${selected.posterPath}` }} style={s.confirmPoster} contentFit="cover" />
            ) : (
              <View style={[s.confirmPoster, s.posterFallback]} />
            )}
            <Text style={s.confirmTitle}>{selected?.title}</Text>
            <Text style={s.confirmMeta}>
              {selected?.mediaType === "movie" ? "Movie" : "TV Show"}{selected?.year ? ` · ${selected.year}` : ""}
            </Text>
            <Text style={s.confirmHint}>
              {selected?.mediaType === "movie"
                ? "This will mark the movie as watched with today's date."
                : "This will mark the entire show as watched."}
            </Text>
            <TouchableOpacity
              style={[s.confirmBtn, submitting && s.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.confirmBtnText}>✓ Mark as Watched</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1c1e26" },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#f0f0f6" },
  backBtn: { width: 60 },
  backBtnText: { fontSize: 15, color: "#e8002d", fontWeight: "600" },
  closeBtn: { width: 60, alignItems: "flex-end" },
  closeBtnText: { fontSize: 16, color: "rgba(240,240,246,0.4)" },

  searchRow: { flexDirection: "row", gap: 10, padding: 16 },
  input: { flex: 1, backgroundColor: "#1e2029", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#f0f0f6", fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  searchBtn: { backgroundColor: "#e8002d", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  center: { paddingTop: 60, alignItems: "center" },
  emptyText: { color: "rgba(240,240,246,0.4)", fontSize: 14 },

  resultRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1e2029", borderRadius: 8, overflow: "hidden" },
  resultPoster: { width: 46, height: 69, backgroundColor: "#323440" },
  posterFallback: { backgroundColor: "#323440" },
  resultInfo: { flex: 1, padding: 10 },
  resultTitle: { fontSize: 13, fontWeight: "700", color: "#f0f0f6", marginBottom: 3 },
  resultMeta: { fontSize: 10, color: "rgba(240,240,246,0.4)", textTransform: "uppercase", letterSpacing: 0.5 },
  resultChevron: { fontSize: 20, color: "#e8002d", paddingHorizontal: 14 },

  confirmStep: { flex: 1, alignItems: "center", padding: 24, gap: 16 },
  confirmPoster: { width: 160, height: 240, borderRadius: 10, backgroundColor: "#323440" },
  confirmTitle: { fontSize: 22, fontWeight: "900", color: "#f0f0f6", textAlign: "center" },
  confirmMeta: { fontSize: 12, color: "rgba(240,240,246,0.45)", textTransform: "uppercase", letterSpacing: 1 },
  confirmHint: { fontSize: 13, color: "rgba(240,240,246,0.5)", textAlign: "center", paddingHorizontal: 16 },
  confirmBtn: { backgroundColor: "#e8002d", borderRadius: 10, paddingVertical: 16, paddingHorizontal: 40, marginTop: 8 },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
