"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Tab = "emby" | "stremio";
type Integration = "emby" | "stremio" | "kodi";

interface Exclusion {
  id: number;
  integration: Integration;
  tmdbId: number;
  mediaType: "movie" | "show";
  title: string;
  createdAt: string;
}

export default function IntegrationsPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("emby");
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

  // Fetch API key and Trakt auth status on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch API key
        const keyRes = await fetch("/api/settings/api-key", { credentials: "include", headers: authHeaders });
        if (keyRes.ok) {
          const data = await keyRes.json();
          setApiKey(data.scrobbleApiKey);
        }

        // Fetch Trakt auth status
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
    fetchData();
  }, [token, authHeaders]);

  // Fetch exclusions when tab changes
  useEffect(() => {
    const fetchExclusions = async () => {
      try {
        const excRes = await fetch(`/api/settings/exclusions?integration=${tab}`, { credentials: "include", headers: authHeaders });
        if (excRes.ok) {
          const data = await excRes.json();
          setExclusions((prev) => ({ ...prev, [tab]: data }));
        }
      } catch (err) {
        console.error("Failed to fetch exclusions:", err);
      }
    };
    fetchExclusions();
  }, [tab, authHeaders]);

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
        const error = await res.text();
        console.error("OAuth start error:", res.status, error);
        alert(`Authentication failed: ${res.status}`);
        return;
      }

      const data = await res.json();
      setOAuthUserCode(data.userCode);
      setTraktOAuthOpen(true);

      // Start polling for authorization
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
            // Refetch auth status
            const authRes = await fetch("/api/settings/trakt-auth", { credentials: "include", headers: authHeaders });
            if (authRes.ok) {
              const authData = await authRes.json();
              setTraktConnected(authData.isConnected);
            }
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
    }, 2000); // Poll every 2 seconds
  };

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8">
          <h1 className="text-h1 font-black tracking-tight text-white mb-1">Integrations</h1>
          <p className="text-white/40">Set up scrobbling from your media players.</p>
        </header>

        {/* Tab switcher */}
        <div className="flex bg-[#181818] p-1 rounded-xl border border-white/5 w-fit mb-8">
          {(["emby", "stremio"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                tab === t ? "bg-[#e8002d] text-white" : "text-white/40 hover:text-white"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* API key display */}
        <div className="glass-panel rounded-xl p-5 mb-8">
          <h3 className="font-bold text-white mb-1">API Key</h3>
          <p className="text-xs text-white/40 mb-3">Use this key in the <code className="text-[#e8002d]">X-Api-Key</code> header for all integrations.</p>
          <div className="flex items-center gap-3 bg-[#181818] rounded-lg px-4 py-2 border border-white/10">
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

        {tab === "emby" && (
          <>
            <EmbyGuide baseUrl={BASE_URL} />
            <ExclusionPanel
              integration="emby"
              exclusions={exclusions.emby}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onRefresh={() => {
                // Refetch exclusions
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
        {tab === "stremio" && (
          <>
            <StremioGuide baseUrl={BASE_URL} traktConnected={traktConnected} onTraktConnect={handleTraktConnect} />
            <ExclusionPanel
              integration="stremio"
              exclusions={exclusions.stremio}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onRefresh={() => {
                // Refetch exclusions
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
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#e8002d] flex items-center justify-center text-white text-xs font-black">{n}</div>
      <div className="flex-grow">
        <h4 className="font-bold text-white mb-1">{title}</h4>
        <div className="text-sm text-white/60 space-y-2">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group bg-[#181818] rounded-lg px-4 py-3 border border-white/10 mt-2 mb-2">
      <code className="text-sm text-[#e8002d] font-mono break-all">{children}</code>
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
      <h2 className="text-h3 font-bold text-white mb-6">Emby Setup Guide</h2>
      <div className="flex flex-col gap-6">
        <Step n={1} title="Install the Webhook Plugin">
          <p>Open Emby Server → <strong className="text-white">Plugins → Catalog</strong>. Search for <strong className="text-white">&quot;Webhook&quot;</strong> and install it, then restart Emby Server.</p>
        </Step>
        <Step n={2} title="Add a New Webhook">
          <p>Go to <strong className="text-white">Dashboard → Plugins → Webhook</strong> and click <strong className="text-white">Add Webhook</strong>.</p>
          <p>Set the URL to:</p>
          <CodeBlock>{webhookUrl}</CodeBlock>
        </Step>
        <Step n={3} title="Set the API Key Header">
          <p>Under <strong className="text-white">Request Headers</strong>, add:</p>
          <div className="bg-[#181818] rounded-lg px-4 py-2 border border-white/10 mt-1 font-mono text-sm">
            <span className="text-white/60">Key:</span> <span className="text-[#e8002d]">X-Api-Key</span>
            <span className="text-white/40 mx-2">·</span>
            <span className="text-white/60">Value:</span> <span className="text-[#e8002d]">[your API key above]</span>
          </div>
        </Step>
        <Step n={4} title="Select Events">
          <p>Enable the following events:</p>
          <ul className="list-none space-y-1 mt-1">
            {["PlaybackProgress", "PlaybackStopped"].map((e) => (
              <li key={e} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#e8002d] text-base">check_circle</span>
                <code className="text-white/80">{e}</code>
              </li>
            ))}
          </ul>
        </Step>
        <Step n={5} title="Save and Test">
          <p>Click <strong className="text-white">Save</strong>. Play any content in Emby — it should appear in your History within seconds.</p>
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
          <h2 className="text-h3 font-bold text-white">Stremio Setup Guide</h2>
          <button
            onClick={onTraktConnect}
            disabled={traktConnected}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              traktConnected
                ? "bg-green-600/20 text-green-400 border border-green-600/30 cursor-default"
                : "bg-[#e8002d] text-white hover:bg-[#b8002d]"
            }`}
          >
            {traktConnected ? "✓ Trakt Connected" : "Connect Trakt"}
          </button>
        </div>
        <div className="flex flex-col gap-6">
          <Step n={1} title="Open Stremio">
            <p>Launch Stremio and click the <strong className="text-white">puzzle piece (Addons)</strong> icon in the top bar.</p>
          </Step>
          <Step n={2} title="Install the Addon">
            <p>Click <strong className="text-white">Install from URL</strong> and paste:</p>
            <CodeBlock>{manifestUrl}</CodeBlock>
            <p>Click <strong className="text-white">Install</strong> to confirm.</p>
          </Step>
          <Step n={3} title="Start Watching">
            <p>Play any content in Stremio. Watch events will be automatically scrobbled and appear in your History.</p>
          </Step>
          <div className="bg-[#e8002d]/10 border border-[#e8002d]/20 rounded-xl p-4 text-sm text-white/60">
            <span className="material-symbols-outlined text-[#e8002d] text-base align-middle mr-2">info</span>
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
  onRefresh,
}: {
  integration: Integration;
  exclusions: Exclusion[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onRefresh: () => void;
}) {
  const { token } = useAuth();
  const authHeaders = useMemo(() => token ? { "Authorization": `Bearer ${token}` } : {}, [token]);
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
    <div className="glass-panel rounded-xl p-6 mt-6">
      <h3 className="text-h3 font-bold text-white mb-4">Excluded Titles</h3>
      <p className="text-sm text-white/60 mb-4">
        Titles in this list won't be scrobbled from {integration === "emby" ? "Emby" : integration === "stremio" ? "Stremio" : "Kodi"}.
      </p>

      <div className="space-y-4">
        {/* Search to add */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search titles to exclude..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-grow bg-[#181818] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-[#e8002d]"
          />
          <button className="px-4 py-2 bg-[#e8002d] text-white rounded-lg font-bold hover:bg-[#b8002d] transition-colors">
            Add
          </button>
        </div>

        {/* Exclusion list */}
        {exclusions.length === 0 ? (
          <p className="text-sm text-white/40 py-4 text-center">No excluded titles yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {exclusions.map((excl) => (
              <div
                key={excl.id}
                className="flex items-center justify-between bg-[#181818] rounded-lg px-4 py-2 border border-white/10"
              >
                <div className="flex-grow">
                  <p className="text-white text-sm">{excl.title}</p>
                  <p className="text-xs text-white/40">{excl.mediaType === "show" ? "TV Show" : "Movie"}</p>
                </div>
                <button
                  onClick={() => handleRemove(excl.id)}
                  disabled={removing === excl.id}
                  className="text-white/40 hover:text-[#e8002d] transition-colors material-symbols-outlined text-base"
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
      <div className="bg-[#181818] rounded-xl border border-white/10 p-6 max-w-md w-full mx-4">
        <h3 className="text-h3 font-bold text-white mb-4">Authorize Trakt Access</h3>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-white/60 mb-2">1. Visit this URL on any device:</p>
            <a
              href="https://trakt.tv/activate"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#e8002d] hover:underline text-sm font-mono break-all"
            >
              https://trakt.tv/activate
            </a>
          </div>

          <div>
            <p className="text-sm text-white/60 mb-2">2. Enter this code:</p>
            <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-lg px-4 py-3 border border-[#e8002d]/30">
              <code className="text-lg font-bold text-[#e8002d] tracking-widest flex-grow">{userCode}</code>
              <button
                onClick={handleCopy}
                className="text-white/40 hover:text-white transition-colors material-symbols-outlined text-base"
              >
                {copied ? "check" : "content_copy"}
              </button>
            </div>
          </div>

          <div className="bg-[#e8002d]/10 border border-[#e8002d]/20 rounded-lg p-3">
            <p className="text-xs text-white/60">
              <span className="material-symbols-outlined text-[#e8002d] text-sm align-middle mr-1">info</span>
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
