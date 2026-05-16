import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, RefreshControl } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

type Theme = "red-dark" | "blue-dark" | "red-light" | "blue-light";
const THEMES: { value: Theme; label: string; accent: string; bg: string }[] = [
  { value: "red-dark",   label: "Red Dark",   accent: "#e8002d", bg: "#1c1e26" },
  { value: "blue-dark",  label: "Blue Dark",  accent: "#1a73e8", bg: "#1c1e26" },
  { value: "red-light",  label: "Red Light",  accent: "#e8002d", bg: "#f5f5f5" },
  { value: "blue-light", label: "Blue Light", accent: "#1a73e8", bg: "#f5f5f5" },
];
const THEME_KEY = "trakt_theme";

export default function SettingsScreen() {
  const { token, logout } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [theme, setTheme] = useState<Theme>("red-dark");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!token) return;
    await Promise.all([
      api.getProfile(token).then((p) => {
        if (p) setDisplayName(p.displayName ?? "");
      }).catch(() => {}),
      SecureStore.getItemAsync(THEME_KEY).then((v) => {
        if (v) setTheme(v as Theme);
      }),
    ]);
  }

  useEffect(() => {
    if (!token) return;
    load().finally(() => setLoading(false));
  }, [token]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function handleSaveDisplayName() {
    if (!token) return;
    setSavingDisplayName(true);
    try {
      await api.updateProfile(displayName.trim(), token);
      setEditingDisplayName(false);
    } catch {
      Alert.alert("Error", "Failed to update display name.");
    } finally {
      setSavingDisplayName(false);
    }
  }

  async function handleThemeChange(value: Theme) {
    setTheme(value);
    await SecureStore.setItemAsync(THEME_KEY, value);
  }

  function handleChangeUsername() {
    Alert.prompt(
      "Change Username",
      "Enter your new username:",
      async (newUsername) => {
        if (!newUsername?.trim() || !token) return;
        try {
          await api.changeUsername(newUsername.trim(), token);
          Alert.alert("Success", "Username updated.");
        } catch {
          Alert.alert("Error", "Failed to update username.");
        }
      },
      "plain-text",
    );
  }

  function handleChangePassword() {
    Alert.prompt(
      "Current Password",
      "Enter your current password:",
      (current) => {
        if (!current || !token) return;
        Alert.prompt(
          "New Password",
          "Enter your new password:",
          async (newPass) => {
            if (!newPass?.trim() || !token) return;
            try {
              await api.changePassword(current, newPass.trim(), token);
              Alert.alert("Success", "Password updated.");
            } catch {
              Alert.alert("Error", "Current password incorrect or request failed.");
            }
          },
          "secure-text",
        );
      },
      "secure-text",
    );
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#e8002d" /></View>;
  }

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8002d" colors={["#e8002d"]} />}
    >
      {/* Profile */}
      <SectionHeader title="Profile" />
      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>Display Name</Text>
        {editingDisplayName ? (
          <View style={s.fieldEditRow}>
            <TextInput
              style={s.fieldInput}
              value={displayName}
              onChangeText={setDisplayName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveDisplayName}
              placeholderTextColor="rgba(240,240,246,0.3)"
            />
            <TouchableOpacity style={s.saveBtn} onPress={handleSaveDisplayName} disabled={savingDisplayName}>
              {savingDisplayName
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.saveBtnText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setEditingDisplayName(false)}>
              <Text style={s.cancelBtnText}>âœ•</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.fieldValueRow} onPress={() => setEditingDisplayName(true)}>
            <Text style={s.fieldValue}>{displayName || "â€”"}</Text>
            <Text style={s.fieldEdit}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={s.actionRow} onPress={handleChangeUsername}>
        <Text style={s.actionText}>Change Username</Text>
        <Text style={s.actionChevron}>â€º</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.actionRow} onPress={handleChangePassword}>
        <Text style={s.actionText}>Change Password</Text>
        <Text style={s.actionChevron}>â€º</Text>
      </TouchableOpacity>

      {/* Theme */}
      <SectionHeader title="Color Theme" />
      <Text style={s.todoNote}>âš  Theme selection is saved but not yet applied â€” needs ThemeContext wired through the app.</Text>
      <View style={s.themeGrid}>
        {THEMES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[s.themeOption, theme === t.value && s.themeOptionActive]}
            onPress={() => handleThemeChange(t.value)}
          >
            <View style={[s.themeSwatch, { backgroundColor: t.bg, borderColor: theme === t.value ? t.accent : "rgba(255,255,255,0.1)" }]}>
              <View style={[s.themeAccentDot, { backgroundColor: t.accent }]} />
            </View>
            <Text style={[s.themeLabel, theme === t.value && s.themeLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Account */}
      <View style={{ marginTop: 40 }}>
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={() => Alert.alert("Log out?", "You will need to log in again.", [
            { text: "Cancel", style: "cancel" },
            { text: "Log out", style: "destructive", onPress: logout },
          ])}
        >
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
  root: { flex: 1, backgroundColor: "#1c1e26" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1c1e26" },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 28, marginBottom: 12 },
  sectionAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: "#e8002d" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#f0f0f6" },

  fieldRow: { backgroundColor: "#1e2029", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 8 },
  fieldLabel: { fontSize: 11, color: "rgba(240,240,246,0.45)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldValue: { fontSize: 15, color: "#f0f0f6" },
  fieldEdit: { fontSize: 13, color: "#e8002d", fontWeight: "600" },
  fieldEditRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldInput: { flex: 1, fontSize: 15, color: "#f0f0f6", borderBottomWidth: 1, borderBottomColor: "rgba(232,0,45,0.5)", paddingVertical: 2 },
  saveBtn: { backgroundColor: "#e8002d", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cancelBtn: { paddingHorizontal: 4 },
  cancelBtnText: { color: "rgba(240,240,246,0.4)", fontSize: 16 },

  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1e2029", borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 8 },
  actionText: { fontSize: 14, color: "#f0f0f6" },
  actionChevron: { fontSize: 20, color: "rgba(240,240,246,0.3)" },

  themeGrid: { flexDirection: "row", gap: 10, marginBottom: 8 },
  themeOption: { flex: 1, alignItems: "center", gap: 6 },
  themeOptionActive: {},
  themeSwatch: { width: "100%", height: 44, borderRadius: 8, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  themeAccentDot: { width: 16, height: 16, borderRadius: 8 },
  themeLabel: { fontSize: 10, color: "rgba(240,240,246,0.45)", textAlign: "center" },
  themeLabelActive: { color: "#f0f0f6", fontWeight: "700" },

  todoNote: { fontSize: 11, color: "#e8a000", backgroundColor: "rgba(232,160,0,0.08)", borderRadius: 6, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "rgba(232,160,0,0.2)" },

  logoutBtn: { backgroundColor: "#1e2029", borderRadius: 8, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(232,0,45,0.3)" },
  logoutText: { color: "#e8002d", fontWeight: "700", fontSize: 14 },
});
