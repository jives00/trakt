import { API_BASES } from "./constants";

// Picks which API base is actually reachable. The app may be on Tailscale (use the
// Tailscale host) or on the home LAN with Tailscale down (use the LAN IP). Rather than
// a separate health probe, we let the real request try candidates in order and remember
// the first that works — keeping test fetch-mocking simple (one fetch on the happy path).

let resolvedBase: string | null = null;

// Bases to try for the next request, last-known-good first.
export function apiBaseCandidates(): string[] {
  if (resolvedBase) return [resolvedBase, ...API_BASES.filter((b) => b !== resolvedBase)];
  return [...API_BASES];
}

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
