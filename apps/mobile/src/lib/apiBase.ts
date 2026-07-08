import { API_BASES } from "./constants";

// Resolves which API base is reachable now. The app can be on Tailscale (Tailscale host)
// or on the home LAN with Tailscale down (LAN IP). Probes /health across candidates in
// parallel and returns the first that responds, or null if none do (so callers fail fast).

let resolvedBase: string | null = null;
let resolvePromise: Promise<string | null> | null = null;

async function probe(base: string, timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function resolveApiBase(): Promise<string | null> {
  if (resolvedBase) return Promise.resolve(resolvedBase);
  if (!resolvePromise) {
    resolvePromise = new Promise<string | null>((resolve) => {
      let remaining = API_BASES.length;
      let settled = false;
      const done = (value: string | null) => {
        if (settled) return;
        settled = true;
        if (value) resolvedBase = value;
        resolve(value);
      };
      API_BASES.forEach(async (base) => {
        const ok = await probe(base);
        remaining -= 1;
        if (ok) done(base);
        else if (remaining === 0) done(null);
      });
    }).finally(() => {
      resolvePromise = null;
    });
  }
  return resolvePromise;
}

// Seed a reachable base without probing (used by unit tests to avoid an extra fetch).
export function markBaseReachable(base: string): void {
  resolvedBase = base;
}

export function resetApiBase(): void {
  resolvedBase = null;
}

// Sync best-effort base for building non-fetch URLs. Returns the last reachable base,
// or the primary until one is known.
export function currentApiBase(): string {
  return resolvedBase ?? API_BASES[0];
}
