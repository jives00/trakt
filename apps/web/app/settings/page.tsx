"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme, THEMES } from "@/lib/theme-context";
import { api } from "@/lib/api";
import type { UserProfile } from "@trakt/types";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const { token, isLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    api.getProfile(token).then(setProfile).catch(() => {});
  }, [token, isLoading]);

  useEffect(() => {
    if (profile) setDisplayName(profile.displayName ?? "");
  }, [profile]);

  async function handleSaveProfile() {
    if (!token || !displayName.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await api.updateProfile(displayName.trim(), token);
      setProfile(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8">
          <h1 className="text-h1 font-black tracking-tight text-white mb-1">Settings</h1>
          <p className="text-white/40">App preferences.</p>
        </header>

        <div className="max-w-xl flex flex-col gap-6">
          {/* Profile */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="font-bold text-white mb-1">Display Name</h3>
            <p className="text-xs text-white/40 mb-4">This appears in your dashboard greeting.</p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setSaveError(""); }}
                maxLength={50}
                placeholder="Enter your name"
                className="w-full px-3 py-2 rounded-lg bg-[#181818] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-accent transition-colors"
              />
              {saveError && <p className="text-xs text-accent">{saveError}</p>}
              <button
                onClick={handleSaveProfile}
                disabled={saving || !displayName.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-white font-bold text-sm uppercase tracking-widest hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Theme */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="font-bold text-white mb-1">Theme</h3>
            <p className="text-xs text-white/40 mb-4">Choose your accent color.</p>
            <div className="flex gap-3">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    theme === t.id
                      ? "border-accent bg-accent/10 text-white"
                      : "border-white/10 bg-[#181818] text-white/40 hover:text-white"
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: t.previewColor }}
                  />
                  <span className="text-xs font-bold uppercase tracking-widest">{t.label}</span>
                  {theme === t.id && (
                    <span className="text-[9px] font-black text-accent uppercase tracking-widest">Active</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* App info */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="font-bold text-white mb-3">About</h3>
            <div className="space-y-2 text-sm text-white/40">
              <div className="flex justify-between">
                <span>Version</span>
                <span className="text-white/60">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>API</span>
                <span className="text-white/60 font-mono text-xs">{process.env.NEXT_PUBLIC_API_URL ?? "localhost:3001"}</span>
              </div>
            </div>
          </div>

          {/* Terminology */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="font-bold text-white mb-4">Watchlist vs Collection vs Lists</h3>
            <div className="space-y-4 text-sm text-white/40">
              <div>
                <h4 className="font-semibold text-white mb-1">Watchlist</h4>
                <p className="text-xs leading-relaxed">Shows/movies you <span className="text-white/60">plan to watch</span>. Tracked shows appear in your Up Next dashboard for easy access to what's coming next. Use this for things you want to start.</p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Collection</h4>
                <p className="text-xs leading-relaxed">Shows/movies you <span className="text-white/60">own or have access to</span> (physical media, subscription services, etc.). Also appears in Up Next like Watchlist. Use this to track what media you actually possess.</p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Lists</h4>
                <p className="text-xs leading-relaxed"><span className="text-white/60">Custom organizational containers</span> you create for any purpose (favorites, recommendations, themed collections, etc.). Can contain shows, movies, and episodes. Does NOT affect Up Next â€” purely for curation and reference.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

