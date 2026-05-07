# Trakt Clone — Claude Code Guide

## Project Summary

Personal media tracking app inspired by Trakt.tv (pre-redesign UI). Tracks watch history, collections, and lists for TV shows and movies. Exposes a scrobbling API so Emby, Kodi, and Stremio can push watch events automatically. Single-user only — no community or social features. Metadata sourced from TMDB, TVDB, OMDB, and Fanart.tv. User data in MySQL on EC2.

**Current Status:** Phase 2 (Scrobbling + Integrations) complete. Building detail pages and UI enhancements in Phase 3.

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
| Infra | Docker Compose on EC2 (api, web, caddy) + Caddy (TLS) |

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

**Stremio:** Addon mounted at `/stremio-addon` (manifests + stream handlers). Scrobbling: subtitles trigger → poll `GET /users/{username}/watching` until 204 (watched). Uses `TRAKT_CLIENT_ID` + `TRAKT_CLIENT_SECRET` for OAuth token.

### Metadata sourcing

- TMDB is the canonical source and primary ID. Its `/external_ids` endpoint returns IMDB and TVDB IDs.
- `external_ids` table maps `(media_type, media_id)` to IDs from each source.
- `metadata_fetched_at` is a JSON column tracking per-source fetch timestamps for TTL enforcement.
- On cache miss or TTL expiry, all relevant sources are fetched in parallel then merged.

### Shared types

- All DTOs and DB model types live in `packages/types/`. Read one file there to understand any data shape.
- No barrel re-exports unless necessary.

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