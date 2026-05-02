"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

type Theme = "dark" | "light";

export default function SettingsPage() {
  const { token, isLoading } = useAuth();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    if (isLoading || !token) return;
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) setTheme(saved);
  }, [token, isLoading]);

  function applyTheme(t: Theme) {
    setTheme(t);
    localStorage.setItem("theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.classList.toggle("light", t === "light");
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
          {/* Theme */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="font-bold text-white mb-1">Theme</h3>
            <p className="text-xs text-white/40 mb-4">Choose how the app looks.</p>
            <div className="flex gap-3">
              {([
                { id: "dark", label: "Dark", icon: "dark_mode" },
                { id: "light", label: "Light", icon: "light_mode" },
              ] as { id: Theme; label: string; icon: string }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTheme(t.id)}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    theme === t.id
                      ? "border-[#e8002d] bg-[#e8002d]/10 text-white"
                      : "border-white/10 bg-[#181818] text-white/40 hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">{t.icon}</span>
                  <span className="text-xs font-bold uppercase tracking-widest">{t.label}</span>
                  {theme === t.id && (
                    <span className="text-[9px] font-black text-[#e8002d] uppercase tracking-widest">Active</span>
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
        </div>
      </div>
    </div>
  );
}
