"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, setTokenHandlers } from "./api";

const PROACTIVE_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes, safely before the 15-min JWT expiry

interface AuthState {
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshedRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setTokenHandlers({
      onRefresh: (accessToken) => setToken(accessToken),
      onLogout: () => setToken(null),
    });
    return () => setTokenHandlers({});
  }, []);

  // Redirect to login whenever we land on a token-less state post-load, since
  // pages only check `token` before fetching and never redirect on their own.
  useEffect(() => {
    if (isLoading || token || pathname === "/login") return;
    router.replace("/login");
  }, [isLoading, token, pathname, router]);

  useEffect(() => {
    if (refreshedRef.current) return;
    refreshedRef.current = true;
    // Silent refresh via the httpOnly cookie; if there's no valid session, fall back to
    // passwordless network auto-login (trusted LAN / Tailscale) before giving up.
    (async () => {
      try {
        const res = await api.refresh();
        setToken(res.accessToken);
      } catch {
        try {
          const res = await api.session();
          setToken(res.accessToken);
        } catch {
          setToken(null);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      api
        .refresh()
        .then((res) => setToken(res.accessToken))
        .catch((err) => {
          console.error("Proactive token refresh failed:", err);
          setToken(null);
        });
    }, PROACTIVE_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    setToken(res.accessToken);
  }, []);

  const logout = useCallback(async () => {
    if (token) await api.logout(token).catch(() => {});
    setToken(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
