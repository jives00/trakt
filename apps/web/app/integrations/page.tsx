"use client";

import { useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const SCROBBLE_KEY = "••••••••••••••••";

type Tab = "emby" | "stremio";

export default function IntegrationsPage() {
  const [tab, setTab] = useState<Tab>("emby");
  const [showKey, setShowKey] = useState(false);

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
              {showKey ? SCROBBLE_KEY : "••••••••••••••••••••••••"}
            </code>
            <button
              onClick={() => setShowKey((s) => !s)}
              className="material-symbols-outlined text-white/40 hover:text-white transition-colors text-base"
            >
              {showKey ? "visibility_off" : "visibility"}
            </button>
          </div>
        </div>

        {tab === "emby" && <EmbyGuide baseUrl={BASE_URL} />}
        {tab === "stremio" && <StremioGuide baseUrl={BASE_URL} />}
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

function StremioGuide({ baseUrl }: { baseUrl: string }) {
  const manifestUrl = `${baseUrl}/stremio-addon/manifest.json`;
  return (
    <div className="glass-panel rounded-xl p-6">
      <h2 className="text-h3 font-bold text-white mb-6">Stremio Setup Guide</h2>
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
  );
}
