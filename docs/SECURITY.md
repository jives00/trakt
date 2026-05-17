# Security Implementation

## API

**@fastify/helmet** (`apps/api/src/app.ts:29-38`): Security headers on all responses — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS, and CSP (self-only; allows unsafe-inline for styles and external images/data URIs).

**@fastify/rate-limit** (`apps/api/src/routes/auth.routes.ts:16-19`): `POST /api/auth/login` capped at 10 attempts per 15 minutes per IP.

## Web — Abort Controllers

All fetch calls use AbortSignal to cancel in-flight requests on unmount or navigation. Key utilities in `apps/web/lib/`:

| Utility | Purpose |
|---|---|
| `createApiController()` | Creates an AbortController and registers it for cleanup |
| `cancelAllRequests()` | Cancels all active requests — called on route change |
| `useApiController()` | Hook: creates and cleans up a controller on mount/unmount |
| `useApiCleanup()` | Route-level hook: cancels all pending requests on navigation |

Pattern: use `useApiController()` on data-fetching components, `useApiCleanup()` on route page components.
