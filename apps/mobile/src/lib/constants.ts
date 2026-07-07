// API base candidates, tried in order by the resolver in apiBase.ts. Primary is the
// Tailscale host (baked via EXPO_PUBLIC_API_URL); the LAN fallback keeps the app working
// on the home network when Tailscale is down (the Tailscale host won't resolve then).
export const API_BASES = [
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3002", // primary (synology:3002 in prod)
  process.env.EXPO_PUBLIC_API_LAN_URL ?? "http://192.168.0.105:3002", // home LAN fallback
];

// Deprecated single-base export (kept for compatibility). Prefer apiBaseCandidates()/
// currentApiBase() from apiBase.ts so the LAN fallback is honored.
export const API_BASE = API_BASES[0];
export const TMDB_IMG = "https://image.tmdb.org/t/p/";
