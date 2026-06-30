import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api, setTokenHandlers } from "../lib/api";

const REFRESH_TOKEN_KEY = "trakt_refresh_token";
const PROACTIVE_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes, safely before the 15-min JWT expiry
const MIN_FOREGROUND_REFRESH_GAP_MS = 60 * 1000; // avoid spamming refresh on rapid foreground/background toggles

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
  const tokenRef = useRef<string | null>(null);
  const lastRefreshAtRef = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const clearStoredAuth = useCallback(async () => {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
    setToken(null);
  }, []);

  useEffect(() => {
    setTokenHandlers({
      getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null),
      onRefresh: (accessToken) => {
        lastRefreshAtRef.current = Date.now();
        setToken(accessToken);
      },
      onLogout: () => {
        clearStoredAuth();
      },
    });
    return () => setTokenHandlers({});
  }, [clearStoredAuth]);

  const silentRefresh = useCallback(async () => {
    const stored = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null);
    if (!stored) return;
    try {
      const res = await api.refresh(stored);
      lastRefreshAtRef.current = Date.now();
      setToken(res.accessToken);
    } catch (err) {
      console.error("Token refresh failed:", err);
      await clearStoredAuth();
    }
  }, [clearStoredAuth]);

  useEffect(() => {
    if (refreshedRef.current) return;
    refreshedRef.current = true;

    SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
      .then(async (stored) => {
        if (!stored) return;
        const res = await api.refresh(stored);
        lastRefreshAtRef.current = Date.now();
        setToken(res.accessToken);
      })
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      silentRefresh();
    }, PROACTIVE_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, silentRefresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackground = appStateRef.current !== "active";
      appStateRef.current = nextState;
      if (
        nextState === "active" &&
        wasBackground &&
        tokenRef.current &&
        Date.now() - lastRefreshAtRef.current > MIN_FOREGROUND_REFRESH_GAP_MS
      ) {
        silentRefresh();
      }
    });
    return () => subscription.remove();
  }, [silentRefresh]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, res.refreshToken);
    lastRefreshAtRef.current = Date.now();
    setToken(res.accessToken);
  }, []);

  const logout = useCallback(async () => {
    const stored = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null);
    if (token && stored) await api.logout(token, stored).catch(() => {});
    await clearStoredAuth();
  }, [token, clearStoredAuth]);

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
