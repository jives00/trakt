# Security Implementation

## API

**@fastify/helmet** (`apps/api/src/app.ts:29-38`): Security headers on all responses — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS, and CSP (self-only; allows unsafe-inline for styles and external images/data URIs).

**@fastify/rate-limit** (`apps/api/src/routes/auth.routes.ts:16-19`): `POST /api/auth/login` capped at 10 attempts per 15 minutes per IP.

**Trusted-network auto-login** (`POST /api/auth/session`, `isTrustedRequest` in `apps/api/src/middleware/auth.ts` + `apps/api/src/utils/trustedNetwork.ts`): issues the normal access token + `trakt_refreshToken` cookie without a password when the request is trusted — i.e. it carries **no Cloudflare headers** (`cf-connecting-ip`/`cf-ray`) **and** its raw socket peer IP is in a private/Tailscale range (`request.ip`/X-Forwarded-For is deliberately ignored so it can't be spoofed). Because `trakt-api` is also public via the Cloudflare tunnel, the CF-header check is what guarantees public/tunnel traffic can never mint a user session — it falls through to the existing password / `x-api-key` / export-token paths.

**Scrobble source restriction** (`authenticateScrobble` → `isAllowedScrobbleSource`): the `SCROBBLE_API_KEY` is compiled into the public Nuvio fork builds, so the key alone doesn't prove the caller is you. Every scrobble route also checks where the request came from. Direct traffic (no CF headers) must come from a private or Tailscale socket address. Tunnel traffic must carry a `cf-connecting-ip` listed in `SCROBBLE_ALLOWED_IPS` (exact IPs or IPv4 CIDRs); otherwise it gets a 403 and a `🔒 Scrobble blocked` log line. If the variable is unset, the tunnel is open to anyone with the key.

## Web — Abort Controllers

All fetch calls use AbortSignal to cancel in-flight requests on unmount or navigation. Key utilities in `apps/web/lib/`:

| Utility | Purpose |
|---|---|
| `createApiController()` | Creates an AbortController and registers it for cleanup |
| `cancelAllRequests()` | Cancels all active requests — called on route change |
| `useApiController()` | Hook: creates and cleans up a controller on mount/unmount |
| `useApiCleanup()` | Route-level hook: cancels all pending requests on navigation |

Pattern: use `useApiController()` on data-fetching components, `useApiCleanup()` on route page components.
