import { useState, useRef } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, Keyboard } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { TMDB_IMG } from "../lib/constants";
import type { RootStackParamList } from "../navigation/types";
import type { SearchResult } from "@trakt/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = (SCREEN_W - 16 * 2 - 10) / 2;
const CARD_H = CARD_W * 1.5;

type DiscoverTab = "Trending" | "Popular" | "Top Rated" | "New";
const DISCOVER_TABS: DiscoverTab[] = ["Trending", "Popular", "Top Rated", "New"];

export default function SearchScreen() {
  const { token } = useAuth();
  const nav = useNavigation<Nav>();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>("Trending");
  const [discoverItems, setDiscoverItems] = useState<SearchResult[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  async function runSearch(q: string) {
    if (!q.trim() || !token) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      const data = await api.search(q.trim(), token);
      setResults(data);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadDiscover(tab: DiscoverTab) {
    if (!token) return;
    setDiscoverTab(tab);
    setDiscoverLoading(true);
    try {
      const showCatMap: Record<DiscoverTab, Parameters<typeof api.getShowDiscover>[0]> = {
        Trending: "trending",
        Popular: "popular",
        "Top Rated": "top_rated",
        New: "on_the_air",
      };
      const movieCatMap: Record<DiscoverTab, Parameters<typeof api.getMovieDiscover>[0]> = {
        Trending: "trending",
        Popular: "popular",
        "Top Rated": "top_rated",
        New: "upcoming",
      };
      const [shows, movies] = await Promise.all([
        api.getShowDiscover(showCatMap[tab], token),
        api.getMovieDiscover(movieCatMap[tab], token),
      ]);
      const combined: SearchResult[] = [
        ...shows.items.map((r) => ({ ...r, mediaType: "show" as const, overview: r.overview ?? "" })),
        ...movies.items.map((r) => ({ ...r, mediaType: "movie" as const, overview: r.overview ?? "" })),
      ];
      combined.sort(() => Math.random() - 0.5);
      setDiscoverItems(combined.slice(0, 40));
    } finally {
      setDiscoverLoading(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setResults(null);
    setSearched(false);
    inputRef.current?.focus();
  }

  function handleItemPress(item: SearchResult) {
    if (item.mediaType === "movie") {
      nav.navigate("MovieDetail", { tmdbId: item.tmdbId });
    } else {
      nav.navigate("ShowDetail", { tmdbId: item.tmdbId });
    }
  }

  const isShowingSearch = searched || loading;

  return (
    <View style={s.root}>
      {/* Search bar */}
      <View style={s.searchRow}>
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            placeholder="Search movies and shows…"
            placeholderTextColor="rgba(226,226,226,0.3)"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {query.length > 0 && (
          <TouchableOpacity style={s.searchBtn} onPress={() => runSearch(query)}>
            <Text style={s.searchBtnText}>Go</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Discover tabs (shown when not searching) */}
      {!isShowingSearch && (
        <View style={s.tabRow}>
          {DISCOVER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, discoverTab === tab && s.tabActive]}
              onPress={() => loadDiscover(tab)}
            >
              <Text style={[s.tabText, discoverTab === tab && s.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color="#e8002d" size="large" /></View>
      ) : isShowingSearch && results?.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No results found.</Text>
        </View>
      ) : isShowingSearch && results ? (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
          numColumns={2}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.gridRow}
          renderItem={({ item }) => (
            <MediaCard item={item} onPress={() => handleItemPress(item)} />
          )}
        />
      ) : !isShowingSearch && discoverItems.length === 0 ? (
        <View style={s.center}>
          <TouchableOpacity style={s.discoverBtn} onPress={() => loadDiscover("Trending")}>
            <Text style={s.discoverBtnText}>Load Discover</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={discoverItems}
          keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
          numColumns={2}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.gridRow}
          ListHeaderComponent={discoverLoading ? <ActivityIndicator color="#e8002d" style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => (
            <MediaCard item={item} onPress={() => handleItemPress(item)} />
          )}
        />
      )}
    </View>
  );
}

function MediaCard({ item, onPress }: { item: SearchResult; onPress: () => void }) {
  const posterUrl = item.posterPath ? `${TMDB_IMG}w300${item.posterPath}` : null;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      {posterUrl ? (
        <Image source={{ uri: posterUrl }} style={s.cardImg} contentFit="cover" />
      ) : (
        <View style={[s.cardImg, s.cardImgFallback]}>
          <Text style={s.fallbackLabel}>{item.mediaType === "movie" ? "MOVIE" : "SHOW"}</Text>
        </View>
      )}
      <View style={s.yearBadge}>
        <Text style={s.yearText}>{item.year ?? "–"}</Text>
      </View>
      <View style={s.cardInfo}>
        <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={s.cardType}>{item.mediaType === "movie" ? "MOVIE" : "SHOW"}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1d1d1d" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "rgba(226,226,226,0.4)", fontSize: 15 },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1a1c1c", borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  searchIcon: { fontSize: 18, color: "rgba(226,226,226,0.4)" },
  searchInput: { flex: 1, fontSize: 14, color: "#e2e2e2", padding: 0 },
  clearBtn: { fontSize: 13, color: "rgba(226,226,226,0.3)" },
  searchBtn: {
    backgroundColor: "#e8002d", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  searchBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  tabRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#1a1c1c", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  tabActive: { backgroundColor: "#e8002d", borderColor: "#e8002d" },
  tabText: { fontSize: 12, color: "rgba(226,226,226,0.55)", fontWeight: "600" },
  tabTextActive: { color: "#fff" },

  grid: { padding: 16, paddingBottom: 32 },
  gridRow: { gap: 10, marginBottom: 10 },

  card: { width: CARD_W },
  cardImg: { width: CARD_W, height: CARD_H, borderRadius: 8, backgroundColor: "#282a2b" },
  cardImgFallback: { justifyContent: "center", alignItems: "center" },
  fallbackLabel: { fontSize: 10, color: "rgba(226,226,226,0.3)", letterSpacing: 1 },
  yearBadge: {
    position: "absolute", top: 6, right: 6,
    backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  yearText: { fontSize: 10, fontWeight: "800", color: "#e8002d" },
  cardInfo: { marginTop: 6 },
  cardTitle: { fontSize: 12, fontWeight: "700", color: "#e2e2e2", lineHeight: 16 },
  cardType: { fontSize: 9, color: "rgba(226,226,226,0.35)", letterSpacing: 1, marginTop: 2 },

  discoverBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 8, backgroundColor: "#e8002d" },
  discoverBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
