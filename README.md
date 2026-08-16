# Trakt — Personal Media Tracker

A self-hosted media tracking app inspired by Trakt.tv. Tracks watch history, collections, and lists for TV shows and movies. Scrobbles automatically from Emby, Kodi, and NuvioTV. Metadata from TMDB, TVDB, and OMDB.

**Stack:** Node.js 24 + Fastify API · Next.js 14 web · React Native + Expo Android app · MySQL 8 · Docker Compose

---

## Prerequisites

- **Node.js 24+** and **pnpm 9+**
- **MySQL 8** (local install or Docker)
- **Docker + Docker Compose** (for production deployment)
- **API keys** — see [API Keys](#api-keys) below

---

## API Keys

Register for free API keys from each service:

| Service | URL | Notes |
|---|---|---|
| TMDB | https://www.themoviedb.org/settings/api | Primary metadata source |
| TVDB | https://thetvdb.com/api-information | TV metadata |
| OMDB | https://www.omdbapi.com/apikey.aspx | Ratings (free tier: 1k/day) |

---

## Local Development

### 1. Clone and install

```bash
git clone <your-repo-url>
cd trakt
pnpm install
```

### 2. Set up MySQL

Create a database and user:

```sql
CREATE DATABASE trakt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'trakt'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON trakt.* TO 'trakt'@'localhost';

-- Also create a test database for running the test suite
CREATE DATABASE trakt_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON trakt_test.* TO 'trakt'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
# Metadata API keys
TMDB_API_KEY=your_tmdb_key
TVDB_API_KEY=your_tvdb_key
OMDB_API_KEY=your_omdb_key

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=trakt
DB_USER=trakt
DB_PASSWORD=your_password

# Auth — choose any values
JWT_SECRET=a_long_random_string_at_least_32_chars
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password

# Scrobble API key — any secret string; used by Emby/Kodi/NuvioTV to authenticate
SCROBBLE_API_KEY=another_random_secret
```

### 4. Run database migrations

```bash
pnpm --filter api run migrate
```

This creates all tables. The runner is idempotent — safe to run multiple times.

### 5. Start the dev servers

In two separate terminals:

```bash
pnpm dev:api    # Fastify API on :3002
pnpm dev:web    # Next.js web on :3001
```

Open http://localhost:3001 and log in with your `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

---

## Production Deployment (Docker Compose)

This setup runs both the API and web frontend as Docker containers, with MySQL in a separate shared container.

### 1. Prerequisites on your server

- Docker and Docker Compose
- A `shared-db` external Docker network (see below)
- MySQL 8 running in a Docker container on that network

Create the shared network if it doesn't exist:

```bash
docker network create shared-db
```

Run MySQL on that network (or attach an existing container to it):

```bash
docker run -d \
  --name shared-mysql \
  --network shared-db \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=trakt \
  -e MYSQL_USER=trakt \
  -e MYSQL_PASSWORD=your_password \
  -v /path/to/mysql/data:/var/lib/mysql \
  mysql:8
```

### 2. Clone and configure

```bash
git clone <your-repo-url>
cd trakt
cp .env.example .env
# Edit .env with your production values
# Set DB_HOST=shared-mysql (the container name on the shared network)
```

### 3. Pull and start

```bash
docker compose pull
docker compose up -d
```

Services:
- **API** — port 3002, on `shared-db` network, connects to MySQL by hostname `mysql`
- **Web** — port 3001, on `shared-db` network, proxies `/api/*` to `trakt-api:3002`

> **Note:** The web image has `NEXT_PUBLIC_API_URL` baked in at build time. If you're pulling pre-built images from ghcr.io, this is set to the builder's NAS hostname. To use your own URL, build the images locally with the correct `NEXT_PUBLIC_API_URL` build arg.

### 4. Run migrations

```bash
pnpm --filter api run migrate
```

Or exec into the running API container:

```bash
docker exec -it trakt-api sh -c "pnpm --filter api run migrate"
```

---

## CI/CD with GitHub Actions

The included workflow (`.github/workflows/deploy.yml`) builds Docker images on push to `main` and pushes them to GitHub Container Registry. [Watchtower](https://containrrr.dev/watchtower/) on your server then auto-pulls and restarts the containers within ~5 minutes.

### Required GitHub Secrets

| Secret | Value |
|---|---|
| `TAILSCALE_HOSTNAME` | Your server's hostname or IP (baked into the web image as the API URL) |
| `GMAIL_APP_PASSWORD` | Gmail app password for APK build email notifications |
| `NOTIFY_EMAIL` | Email address for build notifications |

### How it works

```
git push to main
    ↓
GitHub Actions builds API + web images → ghcr.io
    ↓ (~5 min)
Watchtower detects new images → pulls → restarts containers
```

No SSH access required — Watchtower handles the deploy automatically.

---

## Scrobbling Setup

### Emby

In Emby Server → Plugins → Webhooks, add a webhook:

```
POST http://your-server:3002/api/scrobble/emby
Header: X-Api-Key: <your SCROBBLE_API_KEY>
```

Enable events: `Playback Progress`, `Playback Stopped`

### Kodi

Send `POST` requests to:

```
POST http://your-server:3002/api/scrobble/kodi
Header: X-Api-Key: <your SCROBBLE_API_KEY>
```

### NuvioTV

NuvioTV scrobbles directly to this app — no third-party account needed. It posts to
`/api/scrobble/nuvio/start` and `/stop` with the `X-Api-Key` header.

Personal lists are exposed to NuvioTV as browsable catalogs via the built-in addon:

```
http://your-server:3002/nuvio-addon/manifest.json
```

Toggle which lists appear in Settings → Integrations → Configuration.

---

## Android App

The mobile app requires a separate build step. The API URL is **baked into the APK at build time** and cannot be changed without rebuilding.

### GitHub Actions build (recommended)

Push a tag matching `apk-*` to trigger a Gradle build on GitHub Actions:

```bash
git tag apk-$(date +%Y%m%d)
git push origin --tags
```

The APK downloads as an artifact from the Actions tab (~20–30 min build time).

> Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` before building, or update the `Write mobile .env` step in `deploy.yml` to point at your server.

### Local debug build

```bash
cd apps/mobile
npx expo run:android
```

Requires Android Studio and a connected device or emulator.

> **Note:** Always use HTTPS for the API URL in mobile builds if going over the internet. React Native's `fetch` converts POST to GET on HTTP 301 redirects, causing silent failures on login.

---

## Testing

Tests hit a real MySQL database (`trakt_test`). Make sure it exists and your `.env` is configured before running.

```bash
pnpm test              # all tests
pnpm --filter api test # API tests only
pnpm --filter web test # web tests only
```

For parallel test workers, create additional test databases:

```sql
CREATE DATABASE trakt_test_1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- repeat for trakt_test_2 through trakt_test_18
GRANT ALL PRIVILEGES ON `trakt_test_%`.* TO 'trakt'@'localhost';
```

Or set these in `.env` to allow the test runner to create them automatically:

```env
DB_TEST_ADMIN_USER=root
DB_TEST_ADMIN_PASSWORD=your_root_password
```

---

## Project Structure

```
apps/api/          Fastify API server (Node 24, TypeScript)
  src/routes/      Route handlers
  src/services/    Business logic
  migrations/      SQL migration files (run in order)
apps/web/          Next.js 14 (App Router, Tailwind)
apps/mobile/       React Native + Expo SDK 54 (Android)
packages/types/    Shared TypeScript types and Zod schemas
docs/              Design system, security notes, changelog
```

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm install` | Install all dependencies |
| `pnpm dev:api` | Start API in watch mode |
| `pnpm dev:web` | Start Next.js dev server |
| `pnpm test` | Run all tests |
| `pnpm --filter api run migrate` | Run database migrations |
| `docker compose pull && docker compose up -d` | Pull latest images and start |
| `docker compose down` | Stop containers |
| `docker compose logs -f` | Tail container logs |

---

## License

Copyright (c) 2025

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). You may use, share, and adapt it for non-commercial purposes, provided you give appropriate credit and link back to this repository. Commercial use is not permitted.
