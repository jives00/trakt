# Trakt Clone — Claude Code Guide

## Project Summary

Personal media tracking app inspired by Trakt.tv (pre-redesign UI). Tracks watch history, collections, and lists for TV shows and movies. Scrobbling API lets Emby, Kodi, and Nuvio push watch events automatically. Single-user, no social features. Metadata from TMDB, TVDB, and OMDB. User data in MySQL on Synology NAS. Production live with automated GitHub deployment.

---

## Directory Map

```
apps/api/             Fastify API server (Node 24, TypeScript)
  - src/routes/       Route handlers (nuvio-addon mounted at /nuvio-addon)
  - src/services/     Business logic
  - migrations/       SQL migration files
  - scripts/          migrate.ts — CLI migration runner
apps/web/             Next.js 14 (App Router, Tailwind, Material Symbols)
apps/mobile/          React Native + Expo SDK 54 (Android) — full feature parity + manual scrobble
packages/types/       Shared TypeScript types and Zod schemas
docs/                 Documentation (DESIGN.md, SECURITY.md, changelog.md)
```

---

## Stack

| Layer | Technology |
|---|---|
| Backend API | Node.js 24 + Fastify + TypeScript |
| Web | Next.js 14 (App Router) + TypeScript + Tailwind CSS + Material Symbols |
| Mobile | React Native + Expo SDK 54 + NativeWind 4 (Android) |
| Database | MySQL 8 — shared Docker container on Synology NAS |
| Monorepo | pnpm workspaces |
| Infra | Docker Compose on Synology NAS; Tailscale for private access |
| CI/CD | GitHub Actions → ghcr.io → Watchtower auto-deploy |

See **[docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md)** for full hosting, networking, and troubleshooting details.

---

## Environment Variables (`.env` at repo root — never commit)

| Group | Variables |
|---|---|
| Metadata APIs | `TMDB_API_KEY`, `TVDB_API_KEY`, `OMDB_API_KEY` (`FANART_API_KEY` is legacy — no code uses it) |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| Auth | `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` |
| Integrations | `SCROBBLE_API_KEY` |
| Emby | `EMBY_URL`, `EMBY_API_KEY` — for live now-playing progress polling |
| Web | `NEXT_PUBLIC_API_URL` — leave unset in dev (next.config.mjs proxies `/api/*`) |
| Web | `NEXT_PUBLIC_LAN_HOST` — host substituted into the integration URLs shown on the settings page, so Sonarr/Radarr/Emby containers get a name they can resolve (defaults to the NAS LAN IP) |

See `.env.example` for template.

---

## Code Patterns

### API routes

One file per route group in `src/routes/`. Handlers validate input → call service → return. No business logic in handlers. Raw SQL via `mysql2` (no ORM).

### Auth

`POST /api/auth/login` → access token (response body) + refresh token (HttpOnly cookie). Protected routes require `Authorization: Bearer <accessToken>`. `apps/web/middleware.ts` enforces the cookie and redirects to `/login` if missing.

### Scrobbling

**Kodi:** `POST /api/scrobble/kodi` with `X-Api-Key: SCROBBLE_API_KEY`.

**Emby:** `POST /api/scrobble/emby` webhook on `PlaybackProgress`/`PlaybackStopped`. Upsert on `(user_id, media_type, media_id, DATE(watched_at))` — one row per viewing day. 90% completion threshold.

**Nuvio:** `POST /api/scrobble/nuvio/start` and `/stop` with `X-Api-Key: SCROBBLE_API_KEY`. Nuvio sends start (with current progress %) on play/resume and stop on pause/end/exit. Does not send periodic progress updates. The stop payload carries `paused: boolean` — `true` means "user paused, keep the session alive" and is honoured at any progress, including past the completion threshold, so pausing near the end never marks something watched; omitted/`false` means a real stop, which clears `now_playing` immediately and records history if the completion threshold was hit.

Id resolution is local-first: a scrobble only needs the DB row id, so anything already in the library resolves straight from `tv_shows`/`seasons`/`episodes` (or `movies`) and never touches TMDB. The `getOrFetch*` path runs only for titles not yet cached — so a TMDB outage or bad key can no longer drop a session for content you already have.

### Now Playing

All scrobble sources call `updateNowPlaying(source, mediaType, mediaIdDb, progressPct)` regardless of completion threshold. Dashboard hero polls `GET /api/scrobble/now-playing` every 30s.

`now_playing` table: `(user_id, media_type, media_id, progress_pct, source, updated_at)`. UNIQUE on `user_id`. Staleness guard clears ghost sessions if a player crashes: 4 hours since the last update.

No source sends periodic updates, so `getNowPlaying` extrapolates the current position from elapsed time since `updated_at` and the content runtime, and returns nothing once the estimate passes 100% — this, not the staleness guard, is what normally ends a session that never sent a stop. Titles with no stored runtime (unreleased, partial metadata) fall back to `FALLBACK_RUNTIME_MIN` so they still age out.

### Metadata sourcing

TMDB is the canonical ID. On cache miss or TTL expiry, all sources fetch in parallel and merge. `external_ids` table maps `(media_type, media_id)` to IMDB/TVDB/etc. `metadata_fetched_at` is a JSON column with per-source timestamps.

### List Exports

Token-authenticated feeds (no session cookie — safe for external apps). `GET /export/lists/:slugOrId/rss?token=<exportToken>` returns RSS with IMDB/TVDB/TMDB GUIDs (Stremio-compatible). Sonarr/Radarr export endpoints consume the same list data. Tokens generated via `POST /api/settings/export-token`.

### Exclusions

Per-integration title exclusions (`emby`, `kodi`, `nuvio`) prevent scrobbling specific titles. `GET/POST/DELETE /api/settings/exclusions`.

### Shared types

All DTOs and DB model types in `packages/types/`. No barrel re-exports unless necessary.

---

## Deployment

### Docker Services
- **API:** port 3002, on `shared-db` external network, `DB_HOST=mysql`
- **Web:** port 3001, on `shared-db` network, proxies `/api/*` to `trakt-api:3002` (baked in at build time)
- **Migrations:** Manual — `pnpm --filter api run migrate`. Test DBs reset automatically via `resetDb()` in `beforeEach`.

### GitHub Actions
- Push to `main` → build images → push to `ghcr.io/jives00/trakt-api:latest` and `ghcr.io/jives00/trakt-web:latest` → Watchtower auto-deploys within 5 min
- Push `apk-*` tag → build Android APK on Ubuntu via Gradle → upload as workflow artifact

---

## Development Workflow

```
pnpm dev                          # All apps in parallel (only root script)
pnpm --filter api dev             # Fastify API alone
pnpm --filter web dev             # Next.js web alone
pnpm --filter api test            # API tests (no root test script yet)
pnpm --filter api run migrate     # Run DB migrations
```

### Mobile (Android)

```bash
# Dev server only (no build)
cd apps/mobile
npx expo start

# Debug build — installs to connected device/emulator
npx expo run:android
```

**Release APK:** push an `apk-*` tag — GitHub Actions builds on Ubuntu via Gradle (~20–30 min), APK downloads from the Actions tab. See **[docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md)** for the full workflow, pre-build checklist, and local fallback instructions.

---

## Testing

| Layer | Tool |
|---|---|
| API | Vitest + Supertest — hits real `trakt_test` DB, never mock |
| Web | Vitest + React Testing Library + Playwright (E2E) |
| Mobile | Jest + React Native Testing Library (future) |

Tests co-located with source: `src/routes/__tests__/`, `src/services/__tests__/`. `resetDb()` in `beforeEach` truncates and reseeds the test DB.

---

## Coding Standards

0. **Never connect to the database without explicit permission** — the MySQL instance is reachable
   from the dev machine with no tunnel (`synology:3307`), so nothing stops an ad-hoc connection.
   Ask first and wait for a yes, every time. This covers read-only `SELECT`s, the `mysql` CLI, and
   throwaway `mysql2` scripts, against `trakt` and `trakt_test` alike. To answer a question without
   asking, use the HTTP API, the logs, or read the schema from `apps/api/migrations/` — those are
   files, not connections.
1. **Think before coding** — state assumptions, ask when uncertain, name ambiguity before proceeding.
2. **Simplicity first** — minimum code for the problem. No extra abstractions, no impossible-scenario error handling.
3. **Goal-driven** — for multi-step tasks, state a verifiable plan before starting.
4. **Code style** — no docstrings or large comment blocks. Files ~150 lines max; split if larger.

---

## Reference Docs

- **[docs/DESIGN.md](docs/DESIGN.md)** — color tokens, typography, component patterns, filter pills
- **[docs/SECURITY.md](docs/SECURITY.md)** — helmet config, rate limiting, abort controller pattern
- **[docs/changelog.md](docs/changelog.md)** — feature history
- **[docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md)** — hosting, networking, deployment flow, troubleshooting
