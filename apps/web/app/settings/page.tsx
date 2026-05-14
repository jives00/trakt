"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme, THEMES } from "@/lib/theme-context";
import { api } from "@/lib/api";
import type { UserProfile } from "@trakt/types";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type MainTab = "account" | "appearance" | "integrations";
type IntegrationTab = "emby" | "stremio";
type Integration = "emby" | "stremio" | "kodi";

interface Exclusion {
  id: number;
  integration: Integration;
  tmdbId: number;
  mediaType: "movie" | "show";
  title: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { token, isLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mainTab, setMainTab] = useState<MainTab>("account");
  const [intTab, setIntTab] = useState<IntegrationTab>("emby");

  // Account tab state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Integrations tab state
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [traktConnected, setTraktConnected] = useState(false);
  const [exclusions, setExclusions] = useState<Record<Integration, Exclusion[]>>({
    emby: [],
    stremio: [],
    kodi: [],
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [traktOAuthOpen, setTraktOAuthOpen] = useState(false);
  const [oauthUserCode, setOAuthUserCode] = useState<string | null>(null);
  const [oauthAuthorizing, setOAuthAuthorizing] = useState(false);

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, [token]);

  // Load profile
  useEffect(() => {
    if (isLoading || !token) return;
    api.getProfile(token).then(setProfile).catch(() => {});
  }, [token, isLoading]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setUsername(profile.username ?? "");
    }
  }, [profile]);

  // Load integrations data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const keyRes = await fetch("/api/settings/api-key", { credentials: "include", headers: authHeaders });
        if (keyRes.ok) {
          const data = await keyRes.json();
          setApiKey(data.scrobbleApiKey);
        }

        const authRes = await fetch("/api/settings/trakt-auth", { credentials: "include", headers: authHeaders });
        if (authRes.ok) {
          const data = await authRes.json();
          setTraktConnected(data.isConnected);
        }
      } catch (err) {
        console.error("Failed to fetch integrations data:", err);
      } finally {
        setLoading(false);
      }
    };
    if (mainTab === "integrations") {
      fetchData();
    }
  }, [mainTab, authHeaders]);

  // Load exclusions when integration tab changes
  useEffect(() => {
    const fetchExclusions = async () => {
      try {
        const excRes = await fetch(`/api/settings/exclusions?integration=${intTab}`, { credentials: "include", headers: authHeaders });
        if (excRes.ok) {
          const data = await excRes.json();
          setExclusions((prev) => ({ ...prev, [intTab]: data }));
        }
      } catch (err) {
        console.error("Failed to fetch exclusions:", err);
      }
    };
    if (mainTab === "integrations") {
      fetchExclusions();
    }
  }, [intTab, mainTab, authHeaders]);

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

  async function handleChangePassword() {
    if (!token || !currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordSaving(true);
    setPasswordError("");
    setPasswordSuccess(false);
    try {
      await api.changePassword(currentPassword, newPassword, token);
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to change password";
      setPasswordError(message.includes("401") ? "Current password is incorrect" : message);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleChangeUsername() {
    if (!token || !username.trim()) return;
    setUsernameSaving(true);
    setUsernameError("");
    setUsernameSuccess(false);
    try {
      const updated = await api.changeUsername(username.trim(), token);
      setProfile(updated);
      setUsernameSuccess(true);
      setTimeout(() => setUsernameSuccess(false), 3000);
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : "Failed to change username");
    } finally {
      setUsernameSaving(false);
    }
  }

  const handleTraktConnect = async () => {
    try {
      setOAuthAuthorizing(true);
      const res = await fetch("/api/settings/trakt-auth/start", {
        method: "POST",
        credentials: "include",
        headers: authHeaders,
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        console.error("OAuth start error:", res.status);
        alert(`Authentication failed: ${res.status}`);
        return;
      }

      const data = await res.json();
      setOAuthUserCode(data.userCode);
      setTraktOAuthOpen(true);
      pollAuthorizationStatus();
    } catch (err) {
      console.error("Failed to start Trakt OAuth:", err);
      alert("Failed to start Trakt authentication");
    } finally {
      setOAuthAuthorizing(false);
    }
  };

  const pollAuthorizationStatus = async () => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/settings/trakt-auth/check", {
          method: "POST",
          credentials: "include",
          headers: authHeaders,
          body: JSON.stringify({}),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.status === "authorized") {
            clearInterval(pollInterval);
            setTraktOAuthOpen(false);
            setOAuthUserCode(null);
            setTraktConnected(true);
          } else if (data.status === "expired" || data.status === "denied") {
            clearInterval(pollInterval);
            setTraktOAuthOpen(false);
            setOAuthUserCode(null);
            alert(`Trakt authentication ${data.status}`);
          }
        }
      } catch (err) {
        console.error("Failed to check authorization:", err);
      }
    }, 2000);
  };

  if (isLoading) return null;

  const mainTabs: { id: MainTab; label: string; description: string }[] = [
    { id: "account", label: "Account", description: "Manage your profile and security" },
    { id: "appearance", label: "Appearance", description: "Customize your visual experience" },
    { id: "integrations", label: "Integrations", description: "Connect media players and services" },
  ];

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <header className="mb-8">
        <h1 className="text-h1 font-black tracking-tight text-on-surface">Settings</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-start">
        <aside className="lg:sticky lg:top-24">
          <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
            {mainTabs.map((tab) => {
              const active = tab.id === mainTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMainTab(tab.id)}
                  className={
                    active
                      ? "flex-none lg:flex-auto text-left px-4 py-3 rounded-lg bg-accent/15 text-on-surface border border-accent/30"
                      : "flex-none lg:flex-auto text-left px-4 py-3 rounded-lg bg-surface-container-low border border-white/10 text-on-surface-variant/70 hover:text-on-surface hover:border-white/20 hover:bg-surface-container transition-colors"
                  }
                >
                  <span className="block text-sm font-black uppercase tracking-widest">{tab.label}</span>
                  <span className="mt-1 block text-[13px] leading-snug text-white/40">{tab.description}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {mainTab === "account" && (
            <div className="max-w-xl flex flex-col gap-6">
              <div className="mb-5">
                <h2 className="text-h2 font-black tracking-tight text-on-surface">Account</h2>
                <p className="text-sm text-on-surface-variant/70 mt-1">Manage your profile and security</p>
              </div>
              {/* Display Name */}
            <div className="glass-panel rounded-xl p-5">
              <h3 className="font-bold text-on-surface mb-1">Display Name</h3>
              <p className="text-xs text-on-surface-variant mb-4">This appears in your dashboard greeting.</p>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); setSaveError(""); }}
                  maxLength={50}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border border-white/10 text-on-surface placeholder-white/30 focus:outline-none focus:border-accent transition-colors"
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

            {/* Username */}
            <div className="glass-panel rounded-xl p-5">
              <h3 className="font-bold text-on-surface mb-1">Login Name</h3>
              <p className="text-xs text-on-surface-variant mb-4">Your account login username.</p>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setUsernameError(""); }}
                  maxLength={255}
                  placeholder="Enter your username"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border border-white/10 text-on-surface placeholder-white/30 focus:outline-none focus:border-accent transition-colors"
                />
                {usernameError && <p className="text-xs text-accent">{usernameError}</p>}
                {usernameSuccess && <p className="text-xs text-green-400">Username changed successfully</p>}
                <button
                  onClick={handleChangeUsername}
                  disabled={usernameSaving || !username.trim() || username === profile?.username}
                  className="px-4 py-2 rounded-lg bg-accent text-white font-bold text-sm uppercase tracking-widest hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {usernameSaving ? "Updating..." : "Change Username"}
                </button>
              </div>
            </div>

            {/* Change Password */}
            <div className="glass-panel rounded-xl p-5">
              <h3 className="font-bold text-on-surface mb-1">Change Password</h3>
              <p className="text-xs text-on-surface-variant mb-4">Update your account password.</p>
              <div className="flex flex-col gap-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(""); }}
                  placeholder="Current password"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border border-white/10 text-on-surface placeholder-white/30 focus:outline-none focus:border-accent transition-colors"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); }}
                  placeholder="New password"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border border-white/10 text-on-surface placeholder-white/30 focus:outline-none focus:border-accent transition-colors"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(""); }}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border border-white/10 text-on-surface placeholder-white/30 focus:outline-none focus:border-accent transition-colors"
                />
                {passwordError && <p className="text-xs text-accent">{passwordError}</p>}
                {passwordSuccess && <p className="text-xs text-green-400">Password changed successfully</p>}
                <button
                  onClick={handleChangePassword}
                  disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                  className="px-4 py-2 rounded-lg bg-accent text-white font-bold text-sm uppercase tracking-widest hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {passwordSaving ? "Updating..." : "Change Password"}
                </button>
              </div>
            </div>
            </div>
          )}

          {mainTab === "appearance" && (
            <div className="max-w-xl">
              <div className="mb-5">
                <h2 className="text-h2 font-black tracking-tight text-on-surface">Appearance</h2>
                <p className="text-sm text-on-surface-variant/70 mt-1">Customize your visual experience</p>
              </div>
              <div className="glass-panel rounded-xl p-5">
              <h3 className="font-bold text-on-surface mb-1">Theme</h3>
              <p className="text-xs text-on-surface-variant mb-4">Choose your accent color.</p>
              <div className="flex gap-3">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      theme === t.id
                        ? "border-accent bg-accent/10 text-on-surface"
                        : "border-white/10 bg-surface-container text-on-surface-variant hover:text-on-surface"
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
            </div>
          )}

          {mainTab === "integrations" && (
            <div className="max-w-3xl space-y-6">
              <div className="mb-5">
                <h2 className="text-h2 font-black tracking-tight text-on-surface">Integrations</h2>
                <p className="text-sm text-on-surface-variant/70 mt-1">Connect media players and services</p>
              </div>
              {/* Integration Tab Switcher */}
            <div className="flex flex-wrap gap-2">
              {(["emby", "stremio"] as IntegrationTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setIntTab(t)}
                  className={
                    intTab === t
                      ? "px-3 py-2 rounded-full bg-accent text-white text-sm"
                      : "px-3 py-2 rounded-full bg-surface-container-low border border-white/10 text-on-surface-variant/70 text-sm hover:bg-surface-container hover:text-on-surface transition-colors"
                  }
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* API Key */}
            <div className="glass-panel rounded-xl p-5">
              <h3 className="font-bold text-on-surface mb-1">API Key</h3>
              <p className="text-xs text-on-surface-variant mb-3">Use this key in the <code className="text-accent">X-Api-Key</code> header for all integrations.</p>
              <div className="flex items-center gap-3 bg-surface-container rounded-lg px-4 py-2 border border-white/10">
                <code className="text-sm text-white/60 flex-grow font-mono tracking-widest">
                  {loading ? "Loading..." : showKey && apiKey ? apiKey : "••••••••••••••••••••••••"}
                </code>
                {!loading && apiKey && (
                  <button
                    onClick={() => setShowKey((s) => !s)}
                    className="material-symbols-outlined text-white/40 hover:text-white transition-colors text-base"
                  >
                    {showKey ? "visibility_off" : "visibility"}
                  </button>
                )}
              </div>
            </div>

            {/* Integration Guides */}
            {intTab === "emby" && (
              <>
                <EmbyGuide baseUrl={BASE_URL} />
                <ExclusionPanel
                  integration="emby"
                  exclusions={exclusions.emby}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  authHeaders={authHeaders}
                  onRefresh={() => {
                    const fetchExclusions = async () => {
                      const res = await fetch(`/api/settings/exclusions?integration=emby`, { credentials: "include", headers: authHeaders });
                      if (res.ok) {
                        const data = await res.json();
                        setExclusions((prev) => ({ ...prev, emby: data }));
                      }
                    };
                    fetchExclusions();
                  }}
                />
              </>
            )}
            {intTab === "stremio" && (
              <>
                <StremioGuide baseUrl={BASE_URL} traktConnected={traktConnected} onTraktConnect={handleTraktConnect} />
                <ExclusionPanel
                  integration="stremio"
                  exclusions={exclusions.stremio}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  authHeaders={authHeaders}
                  onRefresh={() => {
                    const fetchExclusions = async () => {
                      const res = await fetch(`/api/settings/exclusions?integration=stremio`, { credentials: "include", headers: authHeaders });
                      if (res.ok) {
                        const data = await res.json();
                        setExclusions((prev) => ({ ...prev, stremio: data }));
                      }
                    };
                    fetchExclusions();
                  }}
                />
              </>
            )}

              {/* Trakt OAuth Modal */}
              {traktOAuthOpen && oauthUserCode && (
                <TraktOAuthModal userCode={oauthUserCode} onClose={() => setTraktOAuthOpen(false)} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-black">{n}</div>
      <div className="flex-grow">
        <h4 className="font-bold text-on-surface mb-1">{title}</h4>
        <div className="text-sm text-white/60 space-y-2">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group bg-surface-container rounded-lg px-4 py-3 border border-white/10 mt-2 mb-2">
      <code className="text-sm text-accent font-mono break-all">{children}</code>
      <button
        onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity material-symbols-outlined text-white/40 hover:text-white text-base"
      >
        {copied ? "check" : "content_copy"}
      </button>
    </div>
  );
}

function EmbyGuide({ baseUrl }: { baseUrl: string }) {
  const webhookUrl = `${baseUrl}/api/scrobble/emby`;
  return (
    <div className="glass-panel rounded-xl p-6">
      <h2 className="text-h3 font-bold text-on-surface mb-6">Emby Setup Guide</h2>
      <div className="flex flex-col gap-6">
        <Step n={1} title="Install the Webhook Plugin">
          <p>Open Emby Server → <strong className="text-on-surface">Plugins → Catalog</strong>. Search for <strong className="text-on-surface">&quot;Webhook&quot;</strong> and install it, then restart Emby Server.</p>
        </Step>
        <Step n={2} title="Add a New Webhook">
          <p>Go to <strong className="text-on-surface">Dashboard → Plugins → Webhook</strong> and click <strong className="text-on-surface">Add Webhook</strong>.</p>
          <p>Set the URL to:</p>
          <CodeBlock>{webhookUrl}</CodeBlock>
        </Step>
        <Step n={3} title="Set the API Key Header">
          <p>Under <strong className="text-on-surface">Request Headers</strong>, add:</p>
          <div className="bg-surface-container rounded-lg px-4 py-2 border border-white/10 mt-1 font-mono text-sm">
            <span className="text-white/60">Key:</span> <span className="text-accent">X-Api-Key</span>
            <span className="text-white/40 mx-2">·</span>
            <span className="text-white/60">Value:</span> <span className="text-accent">[your API key above]</span>
          </div>
        </Step>
        <Step n={4} title="Select Events">
          <p>Enable the following events:</p>
          <ul className="list-none space-y-1 mt-1">
            {["PlaybackProgress", "PlaybackStopped"].map((e) => (
              <li key={e} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-accent text-base">check_circle</span>
                <code className="text-white/80">{e}</code>
              </li>
            ))}
          </ul>
        </Step>
        <Step n={5} title="Save and Test">
          <p>Click <strong className="text-on-surface">Save</strong>. Play any content in Emby – it should appear in your History within seconds.</p>
        </Step>
      </div>
    </div>
  );
}

function StremioGuide({
  baseUrl,
  traktConnected,
  onTraktConnect,
}: {
  baseUrl: string;
  traktConnected: boolean;
  onTraktConnect: () => Promise<void>;
}) {
  const manifestUrl = `${baseUrl}/stremio-addon/manifest.json`;

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h3 font-bold text-on-surface">Stremio Setup Guide</h2>
          <button
            onClick={onTraktConnect}
            disabled={traktConnected}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              traktConnected
                ? "bg-green-600/20 text-green-400 border border-green-600/30 cursor-default"
                : "bg-accent text-white hover:bg-accent-hover"
            }`}
          >
            {traktConnected ? "✓ Trakt Connected" : "Connect Trakt"}
          </button>
        </div>
        <div className="flex flex-col gap-6">
          <Step n={1} title="Open Stremio">
            <p>Launch Stremio and click the <strong className="text-on-surface">puzzle piece (Addons)</strong> icon in the top bar.</p>
          </Step>
          <Step n={2} title="Install the Addon">
            <p>Click <strong className="text-on-surface">Install from URL</strong> and paste:</p>
            <CodeBlock>{manifestUrl}</CodeBlock>
            <p>Click <strong className="text-on-surface">Install</strong> to confirm.</p>
          </Step>
          <Step n={3} title="Start Watching">
            <p>Play any content in Stremio. Watch events will be automatically scrobbled and appear in your History.</p>
          </Step>
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-sm text-white/60">
            <span className="material-symbols-outlined text-accent text-base align-middle mr-2">info</span>
            Make sure your Trakt server is reachable from the machine running Stremio (same network or public domain).
          </div>
        </div>
      </div>
    </div>
  );
}

function ExclusionPanel({
  integration,
  exclusions,
  searchQuery,
  setSearchQuery,
  authHeaders,
  onRefresh,
}: {
  integration: Integration;
  exclusions: Exclusion[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  authHeaders: Record<string, string>;
  onRefresh: () => void;
}) {
  const [removing, setRemoving] = useState<number | null>(null);

  const handleRemove = async (id: number) => {
    setRemoving(id);
    try {
      const res = await fetch(`/api/settings/exclusions/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: authHeaders,
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to remove exclusion:", err);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="glass-panel rounded-xl p-6">
      <h3 className="text-h3 font-bold text-on-surface mb-4">Excluded Titles</h3>
      <p className="text-sm text-white/60 mb-4">
        Titles in this list won't be scrobbled from {integration === "emby" ? "Emby" : integration === "stremio" ? "Stremio" : "Kodi"}.
      </p>

      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search titles to exclude..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-grow bg-surface-container border border-white/10 rounded-lg px-4 py-2 text-on-surface placeholder-white/40 focus:outline-none focus:border-accent"
          />
          <button className="px-4 py-2 bg-accent text-white rounded-lg font-bold hover:bg-accent-hover transition-colors">
            Add
          </button>
        </div>

        {exclusions.length === 0 ? (
          <p className="text-sm text-white/40 py-4 text-center">No excluded titles yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {exclusions.map((excl) => (
              <div
                key={excl.id}
                className="flex items-center justify-between bg-surface-container rounded-lg px-4 py-2 border border-white/10"
              >
                <div className="flex-grow">
                  <p className="text-on-surface text-sm">{excl.title}</p>
                  <p className="text-xs text-white/40">{excl.mediaType === "show" ? "TV Show" : "Movie"}</p>
                </div>
                <button
                  onClick={() => handleRemove(excl.id)}
                  disabled={removing === excl.id}
                  className="text-white/40 hover:text-accent transition-colors material-symbols-outlined text-base"
                >
                  {removing === excl.id ? "hourglass_empty" : "close"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TraktOAuthModal({ userCode, onClose }: { userCode: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-container rounded-xl border border-white/10 p-6 max-w-md w-full mx-4">
        <h3 className="text-h3 font-bold text-on-surface mb-4">Authorize Trakt Access</h3>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-white/60 mb-2">1. Visit this URL on any device:</p>
            <a
              href="https://trakt.tv/activate"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline text-sm font-mono break-all"
            >
              https://trakt.tv/activate
            </a>
          </div>

          <div>
            <p className="text-sm text-white/60 mb-2">2. Enter this code:</p>
            <div className="flex items-center gap-2 bg-surface-container-lowest rounded-lg px-4 py-3 border border-accent/30">
              <code className="text-lg font-bold text-accent tracking-widest flex-grow">{userCode}</code>
              <button
                onClick={handleCopy}
                className="text-white/40 hover:text-white transition-colors material-symbols-outlined text-base"
              >
                {copied ? "check" : "content_copy"}
              </button>
            </div>
          </div>

          <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
            <p className="text-xs text-white/60">
              <span className="material-symbols-outlined text-accent text-sm align-middle mr-1">info</span>
              Waiting for authorization... This usually takes less than 30 seconds.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
