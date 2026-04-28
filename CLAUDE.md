# Trakt Clone — Claude Code Guide

## Project Summary

Personal media tracking app inspired by Trakt.tv (pre-redesign UI). Tracks watch history, collections, and lists for TV shows and movies. Exposes a scrobbling API so Emby, Kodi, and Stremio can push watch events automatically. Single-user only — no community or social features. Metadata sourced from TMDB, TVDB, OMDB, and Fanart.tv. User data in MySQL on EC2.

---

## Directory Map

```
apps/api/             Fastify API server (Node 24, TypeScript)
apps/web/             Next.js 14 web app (App Router, Tailwind, shadcn/ui)
apps/mobile/          React Native + Expo (SDK 51)
apps/stremio-addon/   Stremio addon server (Node.js, port 7000)
apps/kodi-addon/      Kodi Python addon — sideloaded, not a Docker service
packages/types/       Shared TypeScript types and Zod schemas (single source of truth for DTOs and DB models)
plans/                Architecture and implementation plan
docs/                 Screenshots and reference images
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
| Infra | Docker Compose on EC2 (api, web, stremio-addon, caddy) + Caddy (TLS) |

---

## Environment Variables (`.env` at repo root — never commit)

```
TMDB_API_KEY          TMDB read access token (JWT) — movies, shows, cast, posters, trailers
TVDB_API_KEY          TVDB API key — episode-level detail, air dates, episode stills
OMDB_API_KEY          OMDB key — aggregated ratings (IMDB, RT, Metacritic)
FANART_API_KEY        Fanart.tv key — clearlogo, clearart, disc art, banners

DB_HOST=localhost  MySQL is installed directly on EC2 — not a Docker container
DB_PORT / DB_NAME / DB_USER / DB_PASSWORD              MySQL connection
JWT_SECRET            Signs access tokens (short-lived, 15 min)
ADMIN_USERNAME        Seeded at startup — the only user account
ADMIN_PASSWORD        Seeded at startup
SCROBBLE_API_KEY      Sent in X-Api-Key header by Kodi/Emby/Stremio
NEXT_PUBLIC_API_URL   Base URL for API calls from the web app
```

`.env.example` is committed to the repo as a template.

---

## Code Patterns

### API routes (`apps/api/src/routes/`)

- One file per route group: `movies.routes.ts`, `shows.routes.ts`, `auth.routes.ts`, etc.
- Route handlers are thin: validate input → call service → return result. No business logic in handlers.
- Services live in `apps/api/src/services/` — one file per domain.
- DB access is raw SQL via `mysql2`. No ORM.
- Migrations are plain `.sql` files in `apps/api/migrations/`.

### Auth

- `POST /api/auth/login` → short-lived JWT access token (response body) + opaque refresh token (HttpOnly cookie)
- All protected routes require `Authorization: Bearer <accessToken>`
- Web stores access token in memory (not localStorage). Mobile uses Expo SecureStore.

### Metadata sourcing

- TMDB is the canonical source and primary ID. Its `/external_ids` endpoint returns IMDB and TVDB IDs.
- `external_ids` table maps `(media_type, media_id)` to IDs from each source.
- `metadata_fetched_at` is a JSON column tracking per-source fetch timestamps for TTL enforcement.
- On cache miss or TTL expiry, all relevant sources are fetched in parallel then merged.

### Shared types

- All DTOs and DB model types live in `packages/types/`. Read one file there to understand any data shape.
- No barrel re-exports unless necessary.

---

## Testing

**Test-first rule:** Before writing feature code for a phase, write the tests for that phase first. Tests define the contract; code makes them pass.

| Layer | Tool |
|---|---|
| API integration | Vitest + Supertest — always hit the real `trakt_test` MySQL DB, never mock it |
| Web components | Vitest + React Testing Library |
| Web E2E | Playwright |
| Mobile | Jest + React Native Testing Library |
| Kodi addon | pytest |
| Stremio addon | Vitest |

Tests are co-located with source: `src/routes/__tests__/`, `src/services/__tests__/`, etc.

`apps/api/src/test/helpers.ts` exports `resetDb()` and `closePool()`. Call `resetDb()` in `beforeEach` to truncate all tables and re-apply `migrations/test-seed.sql`.

---

## Coding Standards

### 1. Think Before Coding

Before implementing: state assumptions explicitly. If uncertain, ask. If multiple interpretations exist, present them — don't pick silently. If a simpler approach exists, say so. If something is unclear, stop and name what's confusing.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Goal-Driven Execution

Transform tasks into verifiable goals before starting. For multi-step tasks, state a plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

### 4. Code conventions that reduce future reads

- No large comments or docstrings (coding standards already enforce this). Comments add tokens Claude has to read without adding information good names don't already carry.
- Short files. If a file exceeds ~150 lines, it's probably doing too much — split it. Claude reads the whole file to understand any part of it.
- No speculative abstractions (also in coding standards). A helper used once is dead weight Claude has to read and reason about.

---

## Keeping Token Use Low

- Use `/clear` between unrelated tasks.
- Reference specific files and line numbers — never ask Claude to "find where X is handled."
- Break large features into small focused tasks (one route, one component, one migration per task).
- Use plan mode for anything touching more than 2–3 files.
- State what you already know about the data shape or DB schema so Claude skips reading it.
