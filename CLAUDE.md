# Trakt Clone — Claude Code Guide

## Project Summary

Personal media tracking app inspired by Trakt.tv (pre-redesign UI). Tracks watch history, collections, and lists for TV shows and movies. Exposes a scrobbling API so Emby, Kodi, and Stremio can push watch events automatically. Single-user only — no community or social features. Metadata sourced from TMDB, TVDB, OMDB, and Fanart.tv. User data in MySQL on EC2.

**Current Status:** Phase 5 in progress. Phase 4 (Trakt.tv import) complete with Season 0 (specials) support. Production environment live on EC2 with automated GitHub deployment. Security hardening (helmet + rate limiting) implemented.

---

## Directory Map

```
apps/api/             Fastify API server (Node 24, TypeScript)           
  - src/routes/       Route handlers (includes stremio-addon mounted at /stremio-addon)
  - src/services/    Business logic
apps/web/             Next.js 14 web app (App Router, Tailwind, shadcn/ui)
apps/mobile/          React Native + Expo (SDK 51)
apps/kodi-addon/      Kodi Python addon — sideloaded, not a Docker service
packages/types/       Shared TypeScript types and Zod schemas (single source of truth for DTOs and DB models)
plans/                Architecture and implementation plan
docs/                 Documentation, screenshots, and design guidelines
```

---

## Stack

| Layer | Technology |
|---|---|
| Backend API | Node.js 24 + Fastify + TypeScript |
| Web | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Mobile | React Native + Expo SDK 51 + TypeScript |
| Database | MySQL 8 — installed directly on EC2, not a Docker service |
| Monorepo | pnpm workspaces |
| Infra | Docker Compose on EC2 (api, web); API on `network_mode: host` |
| TLS | Handled upstream (not Caddy) |
| CI/CD | GitHub Actions → SSH deploy to EC2 on push to main |

---

## Security Hardening (Phase 5)

**API Security:**
- **@fastify/helmet** (`apps/api/src/app.ts:27-36`): Sets security headers on all responses including `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `HSTS`, and `Content-Security-Policy` (self-only by default, allows unsafe-inline for styles and external images/data URIs).
- **@fastify/rate-limit** (`apps/api/src/routes/auth.routes.ts:16-19`): Rate limiting on `POST /api/auth/login` — max 10 attempts per 15 minutes per IP to prevent brute-force attacks.

**Web Security:**
- **Abort Controllers** (`apps/web/lib/api.ts`, `apps/web/lib/use-api-controller.ts`): All fetch calls support AbortSignal to cancel in-flight requests. Utilities:
  - `createApiController()`: Creates an AbortController and registers it for cleanup.
  - `cancelAllRequests()`: Cancels all active requests (called on route change).
  - `useApiController()`: React hook that creates and cleans up an AbortController on component mount/unmount.
  - `useApiCleanup()`: Route-level cleanup hook to cancel all pending requests on navigation.
- Prevents memory leaks, race conditions, and unnecessary network traffic when components unmount or users navigate away.

---

## Environment Variables (`.env` at repo root — never commit)

**Metadata APIs:** `TMDB_API_KEY`, `TVDB_API_KEY`, `OMDB_API_KEY`, `FANART_API_KEY` — fetched in parallel on cache miss.

**Database:** `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — MySQL on EC2 (not Docker).

**Auth:** `JWT_SECRET` (access token, 15 min TTL), `ADMIN_USERNAME`, `ADMIN_PASSWORD` (seeded at startup, single user).

**Integrations:** `SCROBBLE_API_KEY` (X-Api-Key header for Kodi/Emby/Stremio), `TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET` (Stremio polling).

**Web:** `NEXT_PUBLIC_API_URL` (leave unset in dev — next.config.mjs proxies `/api/*`).

See `.env.example` for template.

---

## Code Patterns

### API routes (`apps/api/src/routes/`)

- One file per route group: `movies.routes.ts`, `shows.routes.ts`, `auth.routes.ts`, etc.
- Route handlers: validate input → call service → return result. No business logic in handlers.
- Services: `apps/api/src/services/` — one file per domain.
- DB: raw SQL via `mysql2` (no ORM). Migrations in `apps/api/migrations/` as `.sql` files.

### Auth

- Login: `POST /api/auth/login` → access token (response) + refresh token (HttpOnly `refreshToken` cookie).
- Protected routes: `Authorization: Bearer <accessToken>` required.
- Token storage: Web (memory), Mobile (Expo SecureStore).
- Middleware: `apps/web/middleware.ts` enforces refresh token cookie; redirects to `/login` if missing. Next.js proxies `/api/*` in dev (requires `NEXT_PUBLIC_API_URL` unset).

### Scrobbling Integrations

**Kodi:** Sends `X-Api-Key: SCROBBLE_API_KEY` header to `POST /api/scrobble/kodi` with media type, ID, and progress.

**Emby:** Webhook at `POST /api/scrobble/emby` triggered by `PlaybackProgress` and `PlaybackStopped` events. Upsert strategy: `(user_id, media_type, media_id, DATE(watched_at))` to collapse one viewing into one row. Completion threshold: 80% movies, 70% episodes.

**Stremio:** Addon mounted at `/stremio-addon` (manifests + stream handlers). Scrobbling is hybrid: Stremio subtitle open triggers the start (`startPollLoop`), then progress is tracked by polling Trakt's `GET /users/{username}/watching` every 60s until 204 (stopped). Progress % comes from `data.progress` in the Trakt response (already 0–100); falls back to computing from `started_at`/`expires_at` if not present. Uses `TRAKT_CLIENT_ID` + `TRAKT_CLIENT_SECRET` for OAuth token.

### Now Playing

All scrobble sources (Emby, Stremio, Kodi) update a `now_playing` table via `updateNowPlaying(source, mediaType, mediaIdDb, progressPct)` whenever progress is detected, regardless of completion threshold. This feeds the dashboard hero, which polls `GET /api/scrobble/now-playing` every 30s.

**Database:** `now_playing` table stores `(user_id, media_type, media_id, progress_pct, source, updated_at)`. UNIQUE constraint on `user_id` (single active session). `updated_at` auto-updates, enabling a 5-minute staleness guard to clean up ghost sessions if a player crashes.

**Frontend:** Dashboard hero shows current playback with backdrop image (show backdrop for episodes, movie backdrop for movies), title (linked to detail page), episode number/name or tagline (episode link to episode page), and a progress bar with time watched/% /time remaining. Computes time from `progressPct × runtimeMin` (both sources support this calculation).

### Metadata sourcing

- TMDB is the canonical source and primary ID. Its `/external_ids` endpoint returns IMDB and TVDB IDs.
- Discover pages for `/movies` and `/shows` are TMDB-first. API routes live at `GET /api/discover/movies` and `GET /api/discover/shows`; supported categories are defined in `apps/api/src/services/discover.service.ts`. Top-rated supports period filters (`all_time`, `past_year`, `past_6_months`, `past_3_months`, `past_month`); rolling periods use TMDB `/discover/movie` and `/discover/tv` with vote-average sorting and date windows.
- `external_ids` table maps `(media_type, media_id)` to IDs from each source.
- `metadata_fetched_at` is a JSON column tracking per-source fetch timestamps for TTL enforcement.
- On cache miss or TTL expiry, all relevant sources are fetched in parallel then merged.

### Shared types

- All DTOs and DB model types live in `packages/types/`. Read one file there to understand any data shape.
- No barrel re-exports unless necessary.

### Season 0 (Specials) Support

The `seasons` table includes a `season_type` column (`'regular'` or `'special'`) to distinguish special episodes. TMDB returns this in the season detail response. The UI correctly filters and displays Season 0 specials alongside regular seasons on show detail pages.

### Trakt.tv Data Import

One-time import script at `apps/api/scripts/import-trakt.ts` imports existing watch history, ratings, watchlist, collection, and lists from a Trakt data export.

**Usage:**
1. Export data from https://trakt.tv/settings/data-export
2. Extract zip to `docs/trakt-export/`
3. Run: `pnpm --filter api run import:trakt`

**What it does:**
- Pre-fetches all seasons from TMDB to populate `episodes.tmdb_id` (performance optimization to bound API calls)
- Imports watch history, ratings, watchlist, collection, and lists
- Deduplicates on re-run (safe to retry after failures)
- Logs summary: rows inserted per table, skipped (duplicates), missing TMDB IDs

**Schema expectations:**
- `watch_history.source` includes `'trakt.tv'` enum value
- `episodes.tmdb_id` column populated with TMDB episode IDs
- `watchlist.sort_order` column for Trakt ranking
- `lists.sort_by` and `sort_how` columns for list sorting preferences

## Deployment

**Production:** EC2 instance running Docker Compose with API and web services, fronted by nginx reverse proxy.

### Docker Services
- **API:** Runs with `network_mode: host` on port 3002, connects directly to local MySQL.
- **Web:** Runs on bridge network, bound to `127.0.0.1:3001`.
- **Migrations:** Run automatically on container startup (handled in `apps/api/Dockerfile`).

### Nginx Reverse Proxy
Nginx routes public traffic to the Docker services. Config location: `/etc/nginx/sites-available/trakt` (symlinked to `/etc/nginx/sites-enabled/trakt`).

**Routing:**
- `/` → proxies to web container (port 3001)
- `/api/` → proxies to API container (port 3002)
- `/stremio-addon/` → proxies to API container (port 3002)
- `/phpmyadmin` → local phpmyadmin with auth

TLS is handled by nginx (not by the containers). All requests are `http://18.223.201.191/` (HTTP on EC2; TLS termination happens upstream if needed).

### GitHub Actions Auto-Deploy
Push to `main` triggers workflow (`deploy.yml`), which:
1. SSHes into EC2
2. Pulls latest code
3. Loads `.env` file
4. Runs `docker compose up --build -d` to rebuild and restart containers

## Design Guidelines

Refer to [docs/DESIGN.md](docs/DESIGN.md) for the project's visual identity, color palette, and UI/UX principles. All web and mobile development should adhere to these standards.

## Development Workflow

Common `pnpm` commands:
- `pnpm dev:api` — Start Fastify API server
- `pnpm dev:web` — Start Next.js web app
- `pnpm test` — Run all tests

---

## Testing

**Test-first rule:** Write tests for feature code before implementing. Tests define the contract.

| Layer | Tool |
|---|---|
| API | Vitest + Supertest (hit real `trakt_test` DB, never mock) |
| Web | Vitest + React Testing Library + Playwright (E2E) |
| Mobile | Jest + React Native Testing Library |
| Kodi addon | pytest |

Tests co-located: `src/routes/__tests__/`, `src/services/__tests__/`, etc. API tests: call `resetDb()` in `beforeEach` to truncate and reapply seed (exported from `apps/api/src/test/helpers.ts`).

---

## Coding Standards

### 1. Think Before Coding

State assumptions explicitly. If uncertain, ask. Present multiple interpretations — don't pick silently. If something is unclear, stop and name it.

### 2. Simplicity First

Minimum code that solves the problem. No features beyond what was asked. No abstractions for single-use code. No error handling for impossible scenarios.

### 3. Goal-Driven Execution

For multi-step tasks, state a plan with verifiable steps before starting.

### 4. Code Style

No large comments or docstrings — good names already carry the meaning. Short files (~150 lines max; if larger, split). One comment per file is the norm, not the exception.
