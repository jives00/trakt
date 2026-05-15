import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

type Exclusion = { id: number; title: string; integration: string };
const INTEGRATIONS = ["emby", "stremio", "kodi"] as const;
type Integration = typeof INTEGRATIONS[number];

export default function SettingsScreen() {
  const { token, logout } = useAuth();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [exportToken, setExportToken] = useState<string | null>(null);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [activeInteg, setActiveInteg] = useState<Integration>("emby");
  const [newExclusion, setNewExclusion] = useState("");
  const [loadingApiKey, setLoadingApiKey] = useState(true);
  const [loadingExport, setLoadingExport] = useState(false);
  const [addingExclusion, setAddingExclusion] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.getApiKey(token)
      .then((d) => setApiKey(d.apiKey))
      .finally(() => setLoadingApiKey(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.getExclusions(token, activeInteg)
      .then((d) => setExclusions(d.exclusions))
      .catch(() => {});
  }, [token, activeInteg]);

  async function handleRotateExportToken() {
    if (!token) return;
    setLoadingExport(true);
    const d = await api.rotateExportToken(token);
    setExportToken(d.exportToken);
    setLoadingExport(false);
  }

  async function handleAddExclusion() {
    if (!token || !newExclusion.trim()) return;
    setAddingExclusion(true);
    try {
      await api.addExclusion(newExclusion.trim(), activeInteg, token);
      const d = await api.getExclusions(token, activeInteg);
      setExclusions(d.exclusions);
      setNewExclusion("");
    } finally {
      setAddingExclusion(false);
    }
  }

  async function handleDeleteExclusion(id: number) {
    if (!token) return;
    await api.deleteExclusion(id, token);
    setExclusions((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleLogout() {
    Alert.alert("Log out?", "You will need to log in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logout },
    ]);
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

      {/* API Key */}
      <SectionHeader title="API Key" />
      <View style={s.infoBox}>
        {loadingApiKey ? (
          <ActivityIndicator color="#e8002d" />
        ) : (
          <Text style={s.monoText} selectable>{apiKey ?? "—"}</Text>
        )}
      </View>
      <Text style={s.hint}>Use this key for Emby/Kodi scrobble webhooks.</Text>

      {/* Export Token */}
      <SectionHeader title="Export Token" />
      <View style={s.infoBox}>
        <Text style={s.monoText} selectable numberOfLines={2}>{exportToken ?? "—"}</Text>
      </View>
      <TouchableOpacity style={s.btn} onPress={handleRotateExportToken} disabled={loadingExport}>
        {loadingExport ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={s.btnText}>Generate / Rotate Token</Text>
        )}
      </TouchableOpacity>
      <Text style={s.hint}>Used to access RSS/Sonarr/Radarr export feeds without logging in.</Text>

      {/* Exclusions */}
      <SectionHeader title="Scrobble Exclusions" />
      <View style={s.integTabs}>
        {INTEGRATIONS.map((integ) => (
          <TouchableOpacity
            key={integ}
            style={[s.integTab, activeInteg === integ && s.integTabActive]}
            onPress={() => setActiveInteg(integ)}
          >
            <Text style={[s.integTabText, activeInteg === integ && s.integTabTextActive]}>
              {integ.charAt(0).toUpperCase() + integ.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.addRow}>
        <TextInput
          style={s.exclusionInput}
          placeholder={`Add title to exclude from ${activeInteg}…`}
          placeholderTextColor="rgba(226,226,226,0.3)"
          value={newExclusion}
          onChangeText={setNewExclusion}
          onSubmitEditing={handleAddExclusion}
          returnKeyType="done"
        />
        <TouchableOpacity style={s.addBtn} onPress={handleAddExclusion} disabled={addingExclusion}>
          {addingExclusion ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.addBtnText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>
      {exclusions.length === 0 ? (
        <Text style={s.hint}>No exclusions for {activeInteg}.</Text>
      ) : (
        exclusions.map((e) => (
          <View key={e.id} style={s.exclusionRow}>
            <Text style={s.exclusionTitle} numberOfLines={1}>{e.title}</Text>
            <TouchableOpacity
              onPress={() => handleDeleteExclusion(e.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.exclusionDelete}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Logout */}
      <View style={{ marginTop: 32 }}>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionAccent} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1d1d1d" },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 24, marginBottom: 10 },
  sectionAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: "#e8002d" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#e2e2e2" },

  infoBox: { backgroundColor: "#1a1c1c", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 8 },
  monoText: { fontFamily: "monospace", fontSize: 12, color: "#e2e2e2", lineHeight: 18 },
  hint: { fontSize: 11, color: "rgba(226,226,226,0.35)", marginBottom: 8 },

  btn: { backgroundColor: "#e8002d", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginBottom: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  integTabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  integTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1a1c1c", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  integTabActive: { backgroundColor: "#e8002d", borderColor: "#e8002d" },
  integTabText: { fontSize: 13, color: "rgba(226,226,226,0.6)", fontWeight: "600" },
  integTabTextActive: { color: "#fff" },

  addRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  exclusionInput: { flex: 1, backgroundColor: "#1a1c1c", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#e2e2e2", fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  addBtn: { backgroundColor: "#e8002d", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  exclusionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  exclusionTitle: { flex: 1, fontSize: 13, color: "#e2e2e2" },
  exclusionDelete: { fontSize: 14, color: "rgba(226,226,226,0.3)", paddingLeft: 12 },

  logoutBtn: { backgroundColor: "#1a1c1c", borderRadius: 8, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(232,0,45,0.3)" },
  logoutText: { color: "#e8002d", fontWeight: "700", fontSize: 14 },
});
