# Trakt — Personal Media Tracker

A self-hosted media tracking app inspired by Trakt.tv. Tracks watch history, collections, and lists for TV shows and movies. Scrobbles automatically from Emby, Kodi, and Stremio. Metadata from TMDB, TVDB, OMDB, and Fanart.tv.

**Stack:** Node.js 24 + Fastify API · Next.js 14 web · React Native + Expo Android app · MySQL 8 · Docker Compose

---

## Prerequisites

- **Node.js 24+** and **pnpm 9+**
- **MySQL 8** (local install or remote server)
- **Docker + Docker Compose** (for production deployment)
- **API keys** — see [API Keys](#api-keys) below

---

## API Keys

You'll need to register for free API keys from each service:

| Service | URL | Notes |
|---|---|---|
| TMDB | https://www.themoviedb.org/settings/api | Primary metadata source |
| TVDB | https://thetvdb.com/api-information | TV metadata |
| OMDB | https://www.omdbapi.com/apikey.aspx | Ratings (free tier: 1k/day) |
| Fanart.tv | https://fanart.tv/api-docs/api-docs/ | Artwork |
| Trakt.tv | https://trakt.tv/oauth/applications/new | Optional — only needed for import |

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
FANART_API_KEY=your_fanart_key

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

# Scrobble API key — any secret string; used by Emby/Kodi/Stremio to authenticate
SCROBBLE_API_KEY=another_random_secret

# Trakt.tv OAuth (optional — only needed for importing history from trakt.tv)
TRAKT_CLIENT_ID=
TRAKT_CLIENT_SECRET=

# Leave these as-is for local dev (Next.js proxies /api/* to the API)
NEXT_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_API_URL=http://localhost:3001
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

This setup runs both the API and web frontend in Docker containers. MySQL must be running on the host (not in Docker) — the API container uses `network_mode: host` to reach it directly.

### 1. Server requirements

- Docker and Docker Compose installed
- MySQL 8 running on the host with the `trakt` database and user created (see step above)
- A reverse proxy (nginx recommended) in front of the containers

### 2. Clone and configure

```bash
git clone <your-repo-url>
cd trakt
cp .env.example .env
# Edit .env with your production values
```

For production, set `NEXT_PUBLIC_API_URL` to your public API domain (e.g. `https://yourdomain.com`).

### 3. Build and start

```bash
docker compose up --build -d
```

Services:
- **API** — `network_mode: host`, port 3002
- **Web** — `127.0.0.1:3001:3000` (localhost only, behind reverse proxy)

### 4. Run migrations

```bash
pnpm --filter api run migrate
```

Or exec into the running API container:

```bash
docker exec -it trakt-api sh -c "node apps/api/dist/server.js --migrate"
```

### 5. Nginx configuration

Route traffic to the containers. Minimal example:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Web app
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Stremio addon
    location /stremio-addon/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}
```

---

## CI/CD with GitHub Actions

The included workflow (`.github/workflows/deploy.yml`) SSHes to your server on push to `main`, pulls the latest code, and runs `docker compose up --build -d`.

Add these secrets to your GitHub repository:

| Secret | Value |
|---|---|
| `EC2_HOST` | Your server's IP or hostname |
| `EC2_USER` | SSH username (e.g. `ubuntu`) |
| `EC2_KEY` | Private SSH key (PEM format) |

The `.env` file must already exist on the server before the first deploy — the workflow does not create it.

---

## Scrobbling Setup

### Emby

In Emby Server → Plugins → Webhooks, add a webhook pointing to:

```
POST https://yourdomain.com/api/scrobble/emby
```

Set a custom header: `X-Api-Key: <your SCROBBLE_API_KEY>`

Enable events: `Playback Progress`, `Playback Stopped`

### Kodi

Install a webhook plugin and send `POST` requests to:

```
POST https://yourdomain.com/api/scrobble/kodi
Header: X-Api-Key: <your SCROBBLE_API_KEY>
```

### Stremio

Stremio scrobbling is handled via the built-in addon. Install the addon in Stremio by pointing it at:

```
https://yourdomain.com/stremio-addon/manifest.json
```

Progress is polled from the Trakt.tv API (requires `TRAKT_CLIENT_ID` and `TRAKT_CLIENT_SECRET`).

---

## Android App

The mobile app requires a separate build step. The API URL is **baked into the APK at build time** and cannot be changed without rebuilding.

### Local debug build

```bash
cd apps/mobile
npx expo run:android
```

Requires Android Studio and a connected device or emulator.

### EAS cloud build

```bash
cd apps/mobile
# Set the API URL secret first
eas secret:create --name EXPO_PUBLIC_API_URL --value https://yourdomain.com

eas build --platform android --profile preview   # APK for testing
eas build --platform android --profile production # AAB for Play Store
```

Requires an Expo account and EAS CLI (`npm install -g eas-cli`).

> **Note:** Always use HTTPS for the API URL in mobile builds. React Native's `fetch` converts POST requests to GET on HTTP 301 redirects, causing silent failures on login.

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
| `docker compose up --build -d` | Build and start production containers |
| `docker compose down` | Stop containers |
| `docker compose logs -f` | Tail container logs |

---

## License

Copyright (c) 2025

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). You may use, share, and adapt it for non-commercial purposes, provided you give appropriate credit and link back to this repository. Commercial use is not permitted.
