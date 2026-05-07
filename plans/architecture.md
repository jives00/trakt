# Trakt.tv Clone — Architecture & Implementation Plan

## Context

Build a personal media tracking app inspired by Trakt.tv (pre-redesign UI) and Simkl. The app tracks watch history, collections, and lists for TV shows and movies. It exposes a scrobbling API so Emby and Stremio can push watch events automatically. Metadata (art, plot, cast, ratings) is sourced from multiple providers (TMDB, TVDB, OMDB, Fanart.tv), each used for what it does best. User data lives in MySQL on EC2. The app is single-user only — no community/social features needed.

---

## Prerequisites

Everything here must be done before the build can start. Steps are ordered — complete them top to bottom.

---

### 1. Local Dev Tools

Install these on your dev machine:

| Tool | Version | Install |
|---|---|---|
| Node.js | 24 | [nodejs.org](https://nodejs.org) or `nvm install 24` |
| pnpm | latest | `npm install -g pnpm` |
| Docker Desktop | latest | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| Git | any | already installed on most systems |

Verify:
```bash
node -v        # should print v24.x
pnpm -v
docker info    # should not error
```

---

### 2. Git Repository Setup

You already have Git and a GitHub account. You need one repository to host the monorepo.

1. Go to [github.com/new](https://github.com/new)
2. Create a new **private** repository named `trakt` (or whatever you prefer)
3. Leave it empty (no README, no .gitignore) — you will push from local
4. In your local project root:
   ```bash
   git init
   git remote add origin https://github.com/<your-username>/trakt.git
   ```
5. Create a `.gitignore` at the repo root before your first commit (at minimum ignore `node_modules/`, `.env`, `dist/`, `.next/`)
6. Initial commit and push:
   ```bash
   git add .
   git commit -m "init monorepo"
   git push -u origin main
   ```

The GitHub repository is also required for the CI/CD pipeline in Phase 4 (GitHub Actions + GHCR). The secrets needed there (`EC2_HOST`, `EC2_SSH_KEY`, etc.) are added under **Settings → Secrets and variables → Actions** — that step is deferred to Phase 4.

---

### 3. API Keys (all free)

Register for each service and collect the key. Store them — you will paste them into `.env` in step 6.

#### TMDB
1. Create an account at [themoviedb.org](https://www.themoviedb.org)
2. Go to **Settings → API → Create → Developer**
3. Fill in the form (app name: "Personal Trakt Clone", personal use)
4. Copy the **API Read Access Token** (the long JWT, not the short API key)

#### TVDB
1. Create an account at [thetvdb.com](https://thetvdb.com)
2. Go to **API Access** (top-right menu under your username)
3. Generate an API key and copy it

#### OMDB
1. Go to [omdbapi.com](https://www.omdbapi.com/apikey.aspx)
2. Select the **Free** tier (1,000 requests/day)
3. Submit your email — the key arrives by email within a few minutes

#### Fanart.tv
1. Create an account at [fanart.tv](https://fanart.tv)
2. Go to **Profile → API Key**
3. Copy your personal API key

---

### 4. Mobile Build Prerequisites (Android APK)

Only needed if you plan to build the mobile app. Skip if mobile is out of scope for now.

#### JDK 17
- Windows: download from [adoptium.net](https://adoptium.net) and run the installer
- After install, set `JAVA_HOME` to the JDK directory (e.g. `C:\Program Files\Eclipse Adoptium\jdk-17...`)
- Add `%JAVA_HOME%\bin` to your `PATH`

Verify: `java -version` prints `17.x`

#### Android SDK
- Install [Android Studio](https://developer.android.com/studio)
- Open **SDK Manager → SDK Tools** and install:
  - Android SDK Build-Tools
  - Android SDK Platform-Tools
  - Android Emulator (optional, for local testing)
- Set `ANDROID_HOME` to your SDK path (e.g. `C:\Users\<you>\AppData\Local\Android\Sdk`)

Verify: `adb version` prints a version number

#### EAS CLI + Expo Account
```bash
npm install -g eas-cli
```
1. Create an account at [expo.dev](https://expo.dev)
2. Log in: `eas login`

---

### 5. EC2 Instance (for deployment)

Only needed for production deployment (Phase 5). Skip for local dev.

1. Log into AWS and launch an EC2 instance:
   - AMI: **Ubuntu 24.04 LTS**
   - Instance type: **t3.small** (minimum; t3.medium if budget allows)
   - Storage: 20 GB gp3
   - Security group: open ports **22** (SSH), **80** (HTTP), **443** (HTTPS)
2. Allocate an **Elastic IP** and attach it to the instance
3. Point your domain's A record at the Elastic IP (needed for Caddy HTTPS)
4. SSH in and install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```

---

### 6. Emby Server (for scrobble testing)

If you have Emby Server running already, just install the **Webhook plugin**:
1. Open Emby Server → **Plugins → Catalog**
2. Search for "Webhook" and install it
3. Restart Emby Server
4. Configuration happens later (Phase 3) once the API is running

If Emby is not yet installed, download from [emby.media](https://emby.media/emby-server.html).

---

### 7. Create the `.env` File

At the repo root, create a file named `.env` (never commit this). A committed `.env.example` in the repo will serve as the template — copy it to `.env` and fill in real values. Paste in your keys from step 3:

```env
# Metadata API keys
TMDB_API_KEY=your_tmdb_read_access_token
TVDB_API_KEY=your_tvdb_api_key
OMDB_API_KEY=your_omdb_api_key
FANART_API_KEY=your_fanart_api_key

# Database
DB_HOST=mysql
DB_PORT=3306
DB_NAME=trakt
DB_USER=trakt
DB_PASSWORD=choose_a_strong_password

# Auth
JWT_SECRET=choose_a_long_random_string
ADMIN_USERNAME=your_username
ADMIN_PASSWORD=choose_a_strong_password

# Scrobble API key (used by Emby and Stremio to authenticate)
SCROBBLE_API_KEY=choose_a_long_random_string

# Web app
NEXT_PUBLIC_API_URL=http://localhost:3001
```

For production, `NEXT_PUBLIC_API_URL` becomes your public domain (e.g. `https://trakt.yourdomain.com`).

---

### 8. Confirm Readiness Checklist

Before starting the build, verify all of the following:

- [ ] `node -v` prints `v24.x`
- [ ] `pnpm -v` prints a version
- [ ] `docker info` runs without error
- [ ] TMDB API key collected
- [ ] TVDB API key collected
- [ ] OMDB API key collected
- [ ] Fanart.tv API key collected
- [ ] `.env` file created at repo root with all values filled in
- [ ] (Mobile) `java -version` prints `17.x`, `JAVA_HOME` set
- [ ] (Mobile) `ANDROID_HOME` set, `adb version` works, `eas login` done
- [ ] (Deployment) EC2 instance running, domain pointed at Elastic IP

---

## Keeping Claude Token Use Low

Token use grows when Claude has to search broadly, read large files, or re-establish context it already had. The strategies below address each cause.

### Project structure decisions (one-time, built into this plan)

- **`packages/types` as the single source of truth for all DTOs and DB models.** Claude reads one file to understand any data shape — no hunting across apps.
- **Thin route handlers, logic in services.** Route files stay small (validation + call service + return). Claude rarely needs to read both.
- **One file per route group, one file per service.** `movies.routes.ts`, `shows.routes.ts`, `scrobble.service.ts`. Predictable names mean Claude can be pointed directly rather than searching.
- **`__tests__` directories co-located with source.** Tests document intent. Claude can read a test file instead of a long explanation of what a function is supposed to do.
- **No barrel re-exports unless necessary.** Deep re-export chains force Claude to trace imports across multiple files.

### CLAUDE.md content (carry this over when created)

A well-maintained `CLAUDE.md` is the single biggest lever. It should contain:
- A one-paragraph project summary (eliminates re-explaining context)
- Directory map with one-line purpose per app/package
- Common patterns: how routes are structured, how services call the DB, how tests are organized
- Where the `.env` keys are and what they do

Every sentence in `CLAUDE.md` that Claude can read once prevents multiple file reads later.

### Per-task workflow practices

- **Use `/clear` between unrelated tasks.** Don't carry context from a scrobble debugging session into a UI build task.
- **Reference specific files and line numbers.** "Look at `apps/api/src/routes/movies.ts`" costs far fewer tokens than "find where movies are handled."
- **Break large features into small focused tasks.** One route, one component, one migration per task. Claude reads only what's relevant.
- **Use plan mode for anything touching more than 2–3 files.** Aligning on approach before generating code avoids expensive wrong-direction work.
- **State what you already know.** "The `watch_history` table uses `media_type` + `media_id` — just add the index" lets Claude skip reading the schema.

### Code conventions that reduce future reads

- No large comments or docstrings (coding standards already enforce this). Comments add tokens Claude has to read without adding information good names don't already carry.
- Short files. If a file exceeds ~150 lines, it's probably doing too much — split it. Claude reads the whole file to understand any part of it.
- No speculative abstractions (also in coding standards). A helper used once is dead weight Claude has to read and reason about.

---

## Coding Standards

### 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria allow independent iteration. Weak criteria ("make it work") require constant clarification.

> These standards should be carried into `CLAUDE.md` when that file is created.

---

## Stack

| Layer | Technology |
|---|---|
| Backend API | Node.js 24 + Fastify + TypeScript |
| Web | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Mobile | React Native + Expo (SDK 51) + TypeScript — local APK builds via EAS CLI `--local` |
| Database | MySQL 8 on EC2 |
| Metadata sources | TMDB + TVDB + OMDB + Fanart.tv (all free) |
| Infra | Docker Compose on EC2 |
| Monorepo | pnpm workspaces |

---

## Monorepo Structure

```
trakt/
├── apps/
│   ├── api/             # Fastify API server
│   ├── web/             # Next.js web app
│   ├── mobile/          # React Native / Expo
│   └── stremio-addon/   # Stremio addon (Node.js)
├── packages/
│   └── types/           # Shared TypeScript types (DTOs, DB models)
├── docker-compose.yml
├── docker-compose.dev.yml
├── pnpm-workspace.yaml
└── package.json
```

---

## Database Schema (MySQL)

### Metadata cache tables (populated from TMDB on demand)
```sql
movies          (id, tmdb_id, title, year, overview, poster_path, backdrop_path, runtime_min, genres, metadata_fetched_at JSON, created_at, updated_at)
tv_shows        (id, tmdb_id, title, year, overview, poster_path, backdrop_path, status, network, genres, metadata_fetched_at JSON, created_at, updated_at)
seasons         (id, show_id FK, season_number, episode_count, overview, poster_path, air_date)
episodes        (id, season_id FK, show_id FK, episode_number, title, overview, still_path, air_date, runtime_min)
people          (id, tmdb_id, name, profile_path, biography)
credits         (id, media_type, media_id, person_id FK, character, role [cast|crew], order)
```
`metadata_fetched_at` is a JSON object keyed by source name (e.g. `{"tmdb": "2024-01-01T00:00:00Z", "tvdb": "..."}`) used to enforce per-source TTLs without extra columns.

### User data tables
```sql
users           (id, username, email, password_hash, theme VARCHAR(32) DEFAULT 'dark', created_at)  -- single row in practice
watch_history   (id, user_id FK, media_type [movie|episode], media_id, watched_at, progress_pct, source [manual|emby|stremio])
collection      (id, user_id FK, media_type, media_id, added_at)
watchlist       (id, user_id FK, media_type, media_id, added_at)
lists           (id, user_id FK, name, description, privacy, created_at)
list_items      (id, list_id FK, media_type, media_id, added_at, sort_order)
ratings         (id, user_id FK, media_type, media_id, rating [1-10], rated_at)
notes           (id, user_id FK, media_type, media_id, body, created_at, updated_at)
scrobble_exclusions (id, integration [emby|stremio], tmdb_id, media_type [movie|show], title, created_at)
```

---

## API Design (Fastify)

### Metadata endpoints
```
GET  /api/search?q=&type=[movie|show|all]
GET  /api/movies?filter=[trending|popular|anticipated]
GET  /api/movies/:tmdbId
GET  /api/shows?filter=[trending|popular|anticipated]
GET  /api/shows/:tmdbId
GET  /api/shows/:tmdbId/seasons/:n
GET  /api/shows/:tmdbId/seasons/:n/episodes/:ep
GET  /api/people/:tmdbId
```

### Auth endpoints
```
POST /api/auth/login     body: { username, password } → { accessToken }  (refresh token in HttpOnly cookie)
POST /api/auth/refresh   → { accessToken }
POST /api/auth/logout
```

### User action endpoints
```
POST   /api/watch                             body: { mediaType, mediaId, watchedAt?, progressPct? }
DELETE /api/watch/:id

POST   /api/collection                        body: { mediaType, mediaId }
DELETE /api/collection/:mediaType/:mediaId
GET    /api/collection?type=[movie|show|all]

POST   /api/watchlist                         body: { mediaType, mediaId }
DELETE /api/watchlist/:mediaType/:mediaId

POST   /api/lists                             body: { name, description }
POST   /api/lists/:id/items
DELETE /api/lists/:id/items/:mediaType/:mediaId

POST   /api/ratings                           body: { mediaType, mediaId, rating }
PUT    /api/ratings/:mediaType/:mediaId       body: { rating }
DELETE /api/ratings/:mediaType/:mediaId
GET    /api/ratings?type=[movie|show|all]&page=&limit=

POST   /api/notes                             body: { mediaType, mediaId, body }
PUT    /api/notes/:mediaType/:mediaId         body: { body }
DELETE /api/notes/:mediaType/:mediaId
```

### Dashboard endpoints
```
GET  /api/dashboard/continue-watching    -- in-progress shows
GET  /api/dashboard/schedule             -- upcoming episodes/movies (next 14 days)
GET  /api/dashboard/stats                -- hours per day for past 30 days
GET  /api/dashboard/recent               -- last N episodes watched
```

### History / Progress / Watchlist endpoints
```
GET  /api/history?type=[movie|episode|all]&page=&limit=
GET  /api/progress?status=[airing|ended|all]
GET  /api/watchlist?type=[movie|show|all]
GET  /api/watch-status/:mediaType/:mediaId    -- watched bool + progress_pct for a single item (used by detail page sidebar and scrobble integrations)
```

### Stats endpoints
```
GET  /api/stats/alltime
GET  /api/stats/year/:year
GET  /api/stats/month/:year/:month
```

### Scrobbling endpoints (for Emby / Stremio)
```
POST /api/scrobble/emby        -- Emby webhook payload
POST /api/scrobble/stremio     -- Stremio tracking addon
```
All scrobble endpoints accept an API key via `X-Api-Key` header (stored in env var). Before writing a `watch_history` row, each handler checks `scrobble_exclusions` for the item's TMDB ID + integration — excluded items are silently dropped.

### Scrobble exclusion endpoints
```
GET    /api/settings/exclusions?integration=[emby|stremio]
POST   /api/settings/exclusions    body: { integration, tmdb_id, media_type, title }
DELETE /api/settings/exclusions/:id
```

---

## Metadata Sources

Rather than a single "best" source, each provider is used for what it does best. Data is fetched on demand, merged, and cached in the local DB.

| Source | What it provides | Cost |
|---|---|---|
| **TMDB** | Primary: movies + shows, cast/crew, posters, backdrops, trailers, release dates | Free |
| **TVDB** | Supplementary TV: episode-level detail, air dates, episode stills | Free (API key) |
| **OMDB** | Aggregated ratings: IMDB score, Rotten Tomatoes %, Metacritic | Free (1000 req/day) |
| **Fanart.tv** | High-quality artwork: clearlogo, clearart, disc art, banners | Free (API key) |

### Field-level source priority

```
poster / backdrop     → TMDB
clearlogo / banner    → Fanart.tv (TMDB rarely has these)
plot / overview       → TMDB primary, TVDB fallback if empty
air_date (episodes)   → TVDB (more precise), TMDB fallback
episode_still         → TVDB primary, TMDB fallback
ratings               → OMDB (IMDB + RT + Metacritic in one fetch)
cast / crew           → TMDB (most complete)
trailers              → TMDB
```

### Caching
- Static fields (title, overview, cast, artwork): 7-day TTL
- Schedule / air dates / status: 1-day TTL
- A `metadata_fetched_at` JSON column per record tracks per-source fetch timestamps
- On cache miss or expiry, all relevant sources are fetched in parallel then merged

### Cross-referencing IDs
TMDB ID is the canonical key. TMDB's `/external_ids` endpoint returns IMDB ID and TVDB ID, so TMDB is always fetched first to bootstrap the ID map for other sources.

```sql
external_ids (media_type, media_id, source [tmdb|tvdb|imdb], external_id)
```

### API Keys (env vars)
```
TMDB_API_KEY
TVDB_API_KEY
OMDB_API_KEY
FANART_API_KEY
```

---

## Web App Pages (Next.js)

```
/                               -- Home dashboard
/shows                          -- TV Shows browser (trending/popular/watched/collected/anticipated)
/shows/[tmdbId]                 -- Show detail
/shows/[tmdbId]/[season]        -- Season detail (episode list)
/shows/[tmdbId]/[season]/[episode]  -- Episode detail
/movies                         -- Movies browser (same layout as TV Shows)
/movies/[tmdbId]                -- Movie detail
/calendar                       -- Upcoming episode/movie calendar grouped by date
/history                        -- Chronological watch log
/progress                       -- In-progress shows with episode completion tracking
/collection                     -- Collected movies and shows
/lists                          -- All lists
/lists/[id]                     -- List detail
/ratings                        -- All personal ratings
/stats                          -- All Time Stats
/stats/year/[year]              -- Year in Review
/stats/month/[year]/[month]     -- Month in Review
/settings                       -- API keys, preferences
/integrations                   -- Setup guides for Emby and Stremio
```

### Integrations Page (`/integrations`)

A tabbed setup guide page with one tab per integration. Each tab shows step-by-step instructions tailored to that service, with the user's actual server URL pre-filled so they can copy-paste without guessing.

| Tab | What it covers |
|---|---|
| **Emby** | Install the Webhook plugin from the Emby plugin catalog; add a new webhook pointing to `http://<your-server>/api/scrobble/emby`; set the `X-Api-Key` header; select `PlaybackProgress` and `PlaybackStopped` events |
| **Stremio** | Paste `http://<your-server>/stremio-addon/manifest.json` into the Stremio addon search bar and click Install |

The server URL is read from the app's environment config (`NEXT_PUBLIC_API_URL`) so it's always correct for the current deployment. The API key is displayed (masked, with a reveal toggle) so the user can copy it into each service's config.

**Exclusion list (per tab):** Each tab includes an "Excluded Titles" section. A search box queries `GET /api/search` so the user can find a show or movie by name — selecting a result adds it to that integration's exclusion list (stored in `scrobble_exclusions` by TMDB ID). Excluded items appear as a list with title, year, and a remove button. The scrobble handler silently drops events whose TMDB ID appears in the list.

### History (`/history`)

Chronological log of every watch event.

- Filter tabs: All | Movies | Shows
- Each row: poster thumbnail, title + episode label (S01E03), watched date/time, source badge (manual / emby / stremio), delete button
- Infinite scroll or pagination
- Maps to `GET /api/history`

### Progress (`/progress`)

Shows the user has started but not finished — distinct from "Up Next" on the dashboard in that it shows completion state per show, not just the next episode to play.

- Each row: show poster, title, seasons progress (e.g. "3 of 5 seasons"), episodes progress bar (e.g. "42 of 73 episodes"), next unwatched episode label, last watched date
- Filter: All | Currently Airing | Ended
- Maps to `GET /api/progress`

### Collection (`/collection`)

Grid of all collected movies and shows.

- Filter tabs: All | Movies | Shows
- Poster grid cards with title and year
- Maps to `GET /api/collection`

### Ratings (`/ratings`)

Grid of everything the user has rated.

- Filter tabs: All | Movies | Shows
- Each card: poster, title, year, star rating (1–10) displayed as a number badge, edit/delete actions
- Sort: by rating (high to low) or by date rated
- Maps to `GET /api/ratings`

### All Time Stats (`/stats`)

Lifetime aggregate watch statistics.

- Summary row: total watch time (days/hours), total shows, total movies, total episodes
- Longest watch streak (consecutive days)
- Top genres (bar or pie chart)
- Top networks/streaming services
- Most watched shows (by play count)
- All-time heatmap (GitHub-style calendar of watch activity)
- Maps to `GET /api/stats/alltime`

### Year in Review (`/stats/year/[year]`)

Annual summary for a given year, navigable by year.

- Totals: hours watched, episodes, movies, new shows started, shows completed
- Monthly breakdown bar chart (hours per month)
- Top show and top movie of the year
- Genre breakdown
- Maps to `GET /api/stats/year/:year`

### Month in Review (`/stats/month/[year]/[month]`)

Monthly summary, navigable by month.

- Totals: hours watched, episodes, movies
- Daily breakdown bar chart (hours per day)
- Shows and movies watched that month (poster grid)
- Maps to `GET /api/stats/month/:year/:month`

---

### Home Dashboard Layout (trakt pre-redesign style)

Single full-width column, sections stacked vertically in this order:

1. **Header bar** — greeting, user stats (days watched, hours, shows/movies collected)
2. **Up next to watch** — horizontal scrolling row of show/movie cards (poster, title, next episode label); maps to `GET /api/dashboard/continue-watching`
3. **Upcoming schedule** — grouped by day (columns), each day listing show title + episode; maps to `GET /api/dashboard/schedule`
4. **Recent episodes** — horizontal card row of the last N episodes watched; maps to `GET /api/dashboard/recent`
5. **Stats bar chart** — full-width bar chart, hours watched per day for the past 30 days (Recharts); maps to `GET /api/dashboard/stats`

Reference: [docs/trackt_screenshots/homepage.png](docs/trackt_screenshots/homepage.png)

### TV Shows & Movies Browser (`/shows`, `/movies`)

Left sidebar + full-width card grid layout. Reference: [docs/trackt_screenshots/tvshows.jpg](docs/trackt_screenshots/tvshows.jpg)

**Left sidebar filters:**
- View: Trending | Popular | Watched | Collected | On Watchlist
- Saved filters: by network/streaming service (Netflix, HBO, etc.)

**Main grid:**
- Backdrop image cards in a responsive masonry-style grid
- Each card shows: backdrop, title, year, TMDB popularity rank badge (for Trending/Popular), and quick-action icons (add to watchlist, add to collection, mark watched)
- Trending and Popular pull from TMDB (`/trending` and `/popular` endpoints)
- Watched / Collected / On Watchlist are filtered views of the user's own data

### Calendar (`/calendar`)

Left sidebar + date-grouped main area. Reference: [docs/trackt_screenshots/calendar.png](docs/trackt_screenshots/calendar.png)

**Left sidebar filters:**
- Content type: TV Shows | Premieres | Movies | Blu-ray
- Network filters (Premium Networks, etc.)

**Main area:**
- Dates as full-width section dividers (e.g. "27", "28")
- Each date shows a horizontal row of large backdrop cards (show/movie name, episode title/number, ratings badge)
- Data sourced from `GET /api/dashboard/schedule` extended to support a longer date range and content-type filtering

### Movie / Show / Episode Detail Pages

Full-bleed backdrop header, then two-column body. Reference: [docs/trackt_screenshots/moviedetail.jpg](docs/trackt_screenshots/moviedetail.jpg)

**Left column:**
- Poster image
- "Watch Now" play button
- External links: TMDB, IMDB, Fanart.tv, Wikipedia

**Center/main column:**
- Title + year + certification badge
- Ratings row: love %, plays count, ratings count, comments count, lists count, fans count
- Metadata: director, release date, runtime, language, genres
- Overview/plot text
- Videos section: Trailer | During Credits | After Credits (YouTube embeds via TMDB)
- Actors grid (headshots + character names)

**Right sidebar:**
- Check In button (marks as watched now)
- Watch history (last played date/time)
- Collection status toggle
- Watchlist toggle
- Personal rating (1–10 star picker)
- Personal notes (text area, saved to `notes` table)

### UI Design Templates

HTML design templates are in `docs/designs/stitch_html_design_optimization-web.zip`. Before implementing any page or component, extract and reference the corresponding HTML file — implementations must be a pixel-perfect match to the design. Any discrepancy between the HTML template and this plan must be raised before implementing (do not silently pick one).

### UI Library
- Tailwind CSS for layout/colors
- shadcn/ui for common components (cards, badges, dialogs)
- Recharts for the bar chart
- Dark theme as default (matching trakt's dark aesthetic)

### Color Theming

The app supports light and dark mode as the initial two themes, with the architecture designed to allow additional themes to be added without structural changes.

**Web (`apps/web/`):**
- Themes are defined as CSS custom property sets in a global stylesheet (e.g. `globals.css`)
- Each theme is a named class on the `<html>` element (e.g. `class="theme-dark"`)
- Tailwind is configured to reference the custom properties rather than hardcoded colors — all color tokens map to `var(--color-*)` variables
- shadcn/ui components use the same CSS variable convention and require no changes per theme
- The active theme name is stored in `localStorage` and applied on mount (avoids flash of wrong theme)
- Adding a new theme = adding one new CSS variable block; no component changes required

**Mobile (`apps/mobile/`):**
- A `ThemeContext` provides the active theme object to the component tree
- Theme objects are plain TypeScript records (`{ background, surface, text, accent, ... }`) defined in a central `themes.ts` file
- Components consume colors via `useTheme()` rather than hardcoded style values
- The active theme name is persisted in Expo SecureStore (or AsyncStorage)
- Adding a new theme = adding one new entry to `themes.ts`; no component changes required

**Shared:**
- The Settings screen (web and mobile) exposes a theme selector — initially two options (Light / Dark), extensible to any number
- The user's theme preference is stored in the `users` table (`theme` column, default `'dark'`) so it roams across devices when the user is logged in

---

## Docker Compose

```yaml
services:
  api:            # Node.js Fastify, port 3001
  web:            # Next.js, port 3000
  stremio-addon:  # Stremio addon server, port 7000
  caddy:          # Reverse proxy, TLS termination, ports 80/443
```
- MySQL is **not** a Docker service — MySQL 8 is already installed directly on EC2. Set `DB_HOST=localhost` in `.env`.
- `.env` file at repo root for secrets (TMDB key, API key, DB creds)
- `.env.example` committed to the repo as a template (no real values)
- Caddy handles HTTPS automatically via Let's Encrypt

---

## Scrobbling Integration Details

### Emby — no custom app required
- Enable the **Emby Webhook plugin** (built into Emby Server) and add a webhook pointing to `POST /api/scrobble/emby`
- Parse `PlaybackProgress` and `PlaybackStopped` events from the webhook payload
- Match by TMDB ID — Emby includes it in the `ProviderIds` field of each payload
- Before writing to `watch_history`, check `scrobble_exclusions` for the item's TMDB ID with `integration='emby'` — drop silently if found

### Stremio — custom addon (`apps/stremio-addon/`)
- Build a Node.js Stremio addon using the [stremio-addon-sdk](https://github.com/Stremio/stremio-addon-sdk)
- The addon exposes a manifest and handles `meta` + `stream` resources so Stremio can install it as a source
- On playback events, the addon calls `POST /api/scrobble/stremio` with the content ID and progress
- Before writing to `watch_history`, check `scrobble_exclusions` for the item's TMDB ID with `integration='stremio'` — drop silently if found
- Hosted as a separate service in Docker Compose (port 7000), reachable by the user's local Stremio client
- Users install the addon by pasting `http://<server>/stremio-addon/manifest.json` into Stremio

---

## Implementation Phases

Build iteratively. Each phase produces something usable before the next begins.

> **Test-first rule:** Before writing any feature code in a phase, draft the test scripts for that phase first. For the API, write Supertest integration tests and seed SQL. For the web, write Playwright smoke tests. For mobile, write RNTL screen skeletons. Tests define the contract; code makes them pass.

### Phase 0 — MVP ✅ COMPLETE
Goal: a working app you can log into, search for content, mark things watched, and see a dashboard. Nothing else.

1. Init pnpm monorepo, configure workspaces; commit `.env.example`
2. `packages/types` — shared TS types and Zod schemas for movies, shows, episodes, watch history
3. `apps/api` — Fastify server, MySQL connection (`mysql2`), raw SQL migrations, auth endpoints (`login` / `refresh` / `logout`)
4. TMDB client module: search, movie detail, show detail, season/episode detail
5. Docker Compose: MySQL + API (local dev only at this stage)
6. `apps/web` — Next.js scaffold, Tailwind + shadcn/ui
7. Login page
8. Search (movies + shows)
9. Movie and Show detail pages (metadata + manual "mark watched" / watchlist / collection toggles)
10. Home dashboard: Up Next + Upcoming Schedule sections only

**Exit criteria:** ✅ MET — Can log in, search for a show, view its detail, mark an episode watched, and see it reflected on the dashboard.

### Phase 0a — Phase 0 Bug Fixes ✅ COMPLETE
Resolve all critical and high bugs found in the Phase 0 code review before starting Phase 1. Do not begin Phase 1 until every item below is fixed and its tests pass.

1. **TMDB API key format** — change `Authorization: Bearer` to `?api_key=` query param in `apps/api/src/services/tmdb.client.ts:9`; all search and detail endpoints are broken until this is fixed
2. **Race condition in toggleWatchlist / toggleCollection** — wrap the read-then-write in a DB transaction in `apps/api/src/services/user-media.service.ts:35-61`
3. **TOCTOU race in getOrFetchMovie / getOrFetchShow** — replace SELECT → INSERT IGNORE → SELECT with `INSERT ... ON DUPLICATE KEY UPDATE` or a transaction in `apps/api/src/services/movies.service.ts:26-42` and `shows.service.ts:40-65`
4. **Unawaited prefetchAllSeasons** — add `.catch()` error handling so unhandled rejections don't crash the process silently — `apps/api/src/routes/shows.routes.ts:68`
5. **authenticate middleware catches too broadly** — narrow the `try/catch` to JWT-specific errors only; let other errors propagate — `apps/api/src/middleware/auth.ts:3-9`
6. **Token lost on page refresh** — restore auth state on mount by calling `POST /api/auth/refresh` (HttpOnly cookie is sent automatically); store the returned access token back in React state — `apps/web/lib/auth-context.tsx:16-28`
7. **Silent error swallowing** — replace all bare `.catch(() => {})` with error state that surfaces a visible message to the user — `apps/web/app/page.tsx:23`, `apps/web/lib/auth-context.tsx:26,36`, `apps/web/app/movies/[tmdbId]/page.tsx:24`
8. **tmdbId validation** — add `Number.isInteger()` check; reject floats and strings that coerce to numbers — `apps/api/src/routes/movies.routes.ts:16-18`
9. **Username whitespace** — add `.trim()` to the username Zod schema so `" "` is rejected — `packages/types/src/auth.ts:4`
10. **Migration script** — replace the `errno === 1060` hack with a `migrations` tracking table; record and skip already-applied migrations — `apps/api/scripts/migrate.ts:19-35`
11. **@trakt/types package.json `main`** — point to the compiled `.js` output (e.g. `dist/index.js`), not the `.ts` source — `packages/types/package.json:5`
12. **Test coverage gaps** — add tests for: API show toggle endpoints (none exist), web movie/show detail pages (0 tests), web dashboard page (0 tests), web auth context (0 tests)

**Exit criteria:** ✅ MET — All Phase 0 tests pass, including the new tests from item 12. The app works end-to-end with no silent failures.

### Phase 1 — Full Web UI ✅ COMPLETE
Complete all remaining web pages. Build order: API-first (all new endpoints + Supertest tests), then web pages one at a time.

**Scoping decisions (locked before build):**
- Settings page: theme preference (light/dark) only for Phase 1; expand in later phases
- Integrations page: static Emby + Stremio setup guides only; exclusion list UI deferred to Phase 2
- Calendar: extend `GET /api/dashboard/schedule` with `?range=` and `?type=` query params rather than a new endpoint
- Watchlist page (`/watchlist`): not in Phase 1; nav link suppressed until later
- Design templates: extracted to a local tmp folder from `docs/designs/stitch_html_design_optimization-web.zip`; reference before implementing any page

**Build steps:**

*API (all with Supertest tests before web work begins):* ✅ COMPLETE (92/92 tests passing — `09f2bc2`)
1. ✅ `GET /api/history` — paginated watch log with `?type=` filter
2. ✅ `GET /api/progress` — in-progress shows with `?status=` filter
3. ✅ `GET /api/collection` — collected items with `?type=` filter
4. ✅ `GET /api/watchlist` — watchlist items with `?type=` filter (endpoint needed even though page is deferred)
5. ✅ `GET/POST/PUT/DELETE /api/lists` and `/api/lists/:id/items`
6. ✅ `GET/POST/PUT/DELETE /api/ratings`
7. ✅ `GET /api/stats/alltime`, `/api/stats/year/:year`, `/api/stats/month/:year/:month`
8. ✅ `GET /api/dashboard/recent` — last N watched episodes
9. ✅ `GET /api/dashboard/stats` — hours per day past 30 days
10. ✅ Extend `GET /api/dashboard/schedule` — add `?range=` (days) and `?type=` (tv|movie|all) params for calendar use

*Web pages (each page: implement → RTL/Playwright test → activate nav link):*
11. Season and Episode detail pages
12. History page (`/history`)
13. Progress page (`/progress`)
14. Collection page (`/collection`)
15. Lists pages (`/lists`, `/lists/[id]`)
16. Ratings page (`/ratings`)
17. Calendar page (`/calendar`)
18. Stats pages (`/stats`, `/stats/year/[year]`, `/stats/month/[year]/[month]`)
19. Integrations page (`/integrations`) — static setup guide only
20. Settings page (`/settings`) — theme toggle only
21. Stats bar chart on dashboard (Recharts, 30-day)
22. Recent Episodes section on dashboard

*Cleanup (after all pages land):* ✅ COMPLETE
23. ✅ **Eliminate type duplication** — moved `MovieStatus`, `ShowStatus`, `ShowDetail`, `EpisodeItem`, `EpisodeDetail`, `UpNextItem`, `ScheduleItem` into `@trakt/types`; renamed `ScheduleItem.airDate` → `date`; removed all local duplicates from `apps/web/lib/api.ts`
24. ✅ **Next.js middleware route guard** — added `apps/web/middleware.ts` (checks `refreshToken` cookie, redirects to `/login`); added `/api/*` proxy rewrite in `next.config.mjs` so cookie is same-origin in dev; removed `router.replace('/login')` from all 14 pages
25. ✅ **Component tests** — RTL tests added for `top-nav.tsx`, `action-buttons.tsx`, `up-next-section.tsx`, `schedule-section.tsx`
26. ✅ **Accessibility fixes** — added `aria-label="Search movies and shows"` to searchbox in `search-results.tsx`; genre list uses index keys in `movies/[tmdbId]/page.tsx`
27. ✅ **Dead code cleanup** — removed `displayDays`/`daysWithContent` dead code from `schedule-section.tsx`

**Exit criteria:**
- All new web pages load without error in Playwright smoke tests: `/shows/[tmdbId]/[season]`, `/shows/[tmdbId]/[season]/[episode]`, `/history`, `/progress`, `/collection`, `/lists`, `/lists/[id]`, `/ratings`, `/calendar`, `/stats`, `/stats/year/[year]`, `/stats/month/[year]/[month]`, `/settings`, `/integrations`
- Dashboard displays the 30-day stats bar chart (Recharts) and recent episodes section
- All new API endpoints have at least one happy-path and one error-path Supertest test
- Stats figures (`/api/stats/alltime`, `/api/stats/year/:year`, `/api/stats/month/:year/:month`) match manually seeded `watch_history` rows in `trakt_test`
- RTL tests pass for `top-nav.tsx`, `action-buttons.tsx`, `up-next-section.tsx`, `schedule-section.tsx`
- No local interface duplicates in `apps/web/lib/api.ts` — all types imported from `@trakt/types`
- `middleware.ts` redirects unauthenticated requests server-side; client-side `useEffect` guards removed
- Nav links for `/history`, `/calendar`, `/collection`, `/ratings`, `/stats` are active with no 404s
- `/watchlist` nav link remains suppressed
- Nav links for `/history`, `/calendar`, `/watchlist` route correctly (no 404s)
- Integrations page renders the static Emby and Stremio setup guides (exclusion list UI deferred to Phase 2)

### Phase 2 — Scrobbling & Client Addons
1. Scrobble API endpoints in `apps/api`: `POST /api/scrobble/emby`, `POST /api/scrobble/stremio`
2. Scrobble exclusion endpoints: `GET/POST/DELETE /api/settings/exclusions`
3. Configure Emby Webhook plugin to point at our endpoint; verify TMDB ID matching from `ProviderIds`
4. Build `apps/stremio-addon/` using stremio-addon-sdk; add `stremio-addon` Docker Compose service (port 7000)
5. Exclusion UI on the Integrations page (search-to-add by show/movie name, per-integration lists)

**Stremio Testing Notes:**
- Dev testing: Stremio on the same machine as the dev server uses `http://localhost:3002/stremio-addon` (API on port 3002)
- **TODO (Phase 3):** Test Stremio on devices on the same network by configuring the addon to use the dev machine's local IP (e.g. `http://192.168.1.X:3002/stremio-addon`)
- **TODO (Phase 3):** Update Stremio addon configuration to use the production domain instead of localhost when deployed to EC2 (e.g. `https://yourdomain.com/stremio-addon/manifest.json`)

### Phase 3 — Production

**EC2 Deployment:**
1. SSH into EC2, clone repo, create `.env` from `.env.example`
2. `docker compose up -d` — starts API, web, stremio-addon, Caddy
3. Caddy automatically provisions Let's Encrypt TLS for your domain
4. Point DNS A record at Elastic IP if not already done
5. Verify HTTPS works and all services are reachable

**Stremio Configuration for Production:**
- Update the Stremio addon manifest URL in all devices from `http://localhost:3002/stremio-addon` to `https://yourdomain.com/stremio-addon/manifest.json`
- Test the addon by playing content on a device and verifying scrobbles appear in watch history
- Verify the addon works on devices on different networks (not just localhost or same LAN)

**GitHub Actions auto-deploy** (see CI/CD section) handles all subsequent deployments on push to `main`.

**Performance:**
- Add an in-process TTL cache (e.g. `node-cache` or a plain `Map` with timestamps) in `apps/api/src/services/tmdb.client.ts` — cache responses for the configured metadata TTLs (7 days for static fields, 1 day for schedule/status) to stay well under TMDB's 60 req/s rate limit under load

**CI/CD fix:**
- Align the Node version in `.github/workflows/ci.yml` with the `"node": ">=24"` engine declared in `package.json`; currently the architecture plan references Node 22 for CI — update to Node 24

---

### Phase 4 — Trakt.tv Data Import (one-time)

A one-time import of existing Trakt.tv data — watch history, ratings, watchlist, collection, and lists. Run once after the app is deployed; data is deduplicated so it's safe to re-run.

#### How it works

Trakt exposes a public REST API (free, no OAuth needed for read-only personal data exports via the `/users/me/...` endpoints when authenticated). The import is a Node.js script in `apps/api/scripts/import-trakt.ts` — not an ongoing service, not a UI feature.

**Auth:** Trakt uses OAuth2. The script follows the device-code flow: print a code + URL, wait for the user to approve in a browser, then exchange the code for an access token. Token is used only for the import run and not stored permanently.

**Data fetched and mapped:**

| Trakt endpoint | Maps to |
|---|---|
| `GET /users/me/history/movies` | `watch_history` rows (`media_type=movie`) |
| `GET /users/me/history/episodes` | `watch_history` rows (`media_type=episode`) |
| `GET /users/me/ratings/movies` | `ratings` rows |
| `GET /users/me/ratings/shows` | `ratings` rows |
| `GET /users/me/ratings/episodes` | `ratings` rows |
| `GET /users/me/watchlist/movies` | `watchlist` rows |
| `GET /users/me/watchlist/shows` | `watchlist` rows |
| `GET /users/me/collection/movies` | `collection` rows |
| `GET /users/me/collection/shows` | `collection` rows |
| `GET /users/me/lists` + `/lists/:id/items` | `lists` + `list_items` rows |

Trakt includes TMDB IDs on every item (`ids.tmdb`), so all records resolve directly to our canonical TMDB-keyed schema without extra lookups.

**Deduplication:** Each insert uses `INSERT IGNORE` (keyed on `user_id + media_type + media_id + watched_at` for history; `user_id + media_type + media_id` for ratings, collection, watchlist). Safe to re-run.

**Pagination:** All Trakt history endpoints are paginated (default 1000/page). The script loops until all pages are consumed.

**Rate limiting:** Trakt allows 1000 API calls per 5-minute window. The script throttles to ~3 req/s to stay well under the limit. Large histories (10k+ entries) take a few minutes.

#### Script location and usage

```
apps/api/scripts/import-trakt.ts
```

```bash
# From repo root
pnpm --filter api import:trakt

# Or directly
npx tsx apps/api/scripts/import-trakt.ts
```

The script logs a summary on completion: rows inserted per table, rows skipped (duplicates), any items where TMDB ID was missing (logged but not fatal).

#### Required env vars (add to `.env`)

```env
TRAKT_CLIENT_ID=your_trakt_app_client_id
TRAKT_CLIENT_SECRET=your_trakt_app_client_secret
```

Register a Trakt app at [trakt.tv/oauth/applications/new](https://trakt.tv/oauth/applications/new) (free, select "Media Center" type, redirect URI can be `urn:ietf:wg:oauth:2.0:oob` for device-code flow).

#### What is NOT imported

- Comments and shouts (no equivalent in this app)
- Trakt-specific ratings for seasons (Trakt supports season ratings; this app does not)
- Social / friend data

#### Verification

After the import, check the dashboard: watch history totals should match your Trakt profile's "movies watched" and "episodes watched" counts. Spot-check 3–5 entries in `/history` against Trakt's history page.

---

### Phase 5 — Polish

**Security hardening:**
- Add `@fastify/helmet` to `apps/api/src/app.ts` — sets `X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, and CSP headers on every response
- Add rate limiting to `POST /api/auth/login` using `@fastify/rate-limit` (e.g. 10 attempts / 15 min per IP) to prevent brute-force attacks
- Strengthen password validation in `packages/types/src/auth.ts` — minimum 8 characters (the single admin password is set once at deploy time; complexity requirements protect the seeded account)
- Add abort controllers to all fetch calls in `apps/web/lib/api.ts` so in-flight requests are cancelled on component unmount or route change

**Mobile offline / caching:**
- Add TanStack Query (React Query) to the mobile app for data caching and stale-while-revalidate
- Cache TTLs: metadata (shows/movies) 24h, dashboard 5min, history/progress 1h
- On app focus, background refetch silently
- No write-queue or true offline mode — reads show cached data when offline, writes fail with a toast notification
- No changes needed to the API

---

### Phase 6 — Mobile App
Full feature parity with the web. Build in the same order as Phases 0–1.

1. Expo scaffold (`npx create-expo-app`); configure `eas.json` with `production` and `preview` profiles; verify `eas build --platform android --local` produces an APK before writing any feature code
2. Set up keystore and signing config
3. Auth (login screen, token storage in Expo SecureStore)
4. Home dashboard screen
5. Shows and Movies browse screens + detail screens (show, season, episode, movie)
6. Search
7. Library tab: History, Progress, Collection, Lists, Ratings, Calendar
8. Stats screens
9. Settings + Integrations screens

---

## Mobile App (React Native + Expo)

Full feature parity with the web app. All web pages have a corresponding mobile screen. Navigation is adapted for mobile conventions using React Navigation.

### Navigation Structure

**Bottom tab nav:** Home | Shows | Movies | Library | Settings

| Tab | Screens |
|---|---|
| **Home** | Dashboard (Up Next, Upcoming Schedule, Recent, Stats bar) |
| **Shows** | Browse (Trending/Popular/Watched/Collected/Watchlist) → Show Detail → Season Detail → Episode Detail |
| **Movies** | Browse (same filters) → Movie Detail |
| **Library** | Sub-tabs: History \| Progress \| Collection \| Lists \| Ratings \| Calendar \| Stats |
| **Settings** | Preferences, API keys, Integrations setup guide |

Stack navigators within each tab for detail screens. The Library tab uses a secondary top tab navigator for its sub-sections.

- Shared API client from `packages/types` for type-safe fetch calls

### APK Build Options

The app uses Expo managed workflow for DX convenience (OTA updates, easy config), but supports **local APK builds** as a first-class option to avoid burning EAS cloud build slots.

**Dev machine requirements for local builds:**
- JDK 17 (`JAVA_HOME` set)
- Android SDK (`ANDROID_HOME` set) — install via Android Studio or `sdkmanager`

**Build commands:**
```bash
# Cloud build (uses an EAS slot — use sparingly)
eas build --platform android

# Local build — no slot consumed, runs on your machine
eas build --platform android --local
# Output: a .apk or .aab in the project root

# Dev/debug — fastest iteration during development
npx expo run:android
```

**`eas.json` config** will define a `production` profile (APK for sideloading) and a `preview` profile (internal testing). The `--local` flag works with both profiles.

**Signing:** Keystore managed by EAS credentials or stored locally; passwords in `.env` (never committed).

**Day-to-day dev workflow:** `npx expo start` + Expo Go for quick iteration; `eas build --local` when a real APK is needed.

---

## Authentication

Single-user app. No registration flow — the account is seeded at startup from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars.

### Flow
1. `POST /api/auth/login` with `{ username, password }` → verifies against bcrypt hash in DB → returns a short-lived **access token** (JWT, 15-min expiry) in the response body and a **refresh token** (opaque, 30-day expiry) in an `HttpOnly` `Secure` cookie
2. All protected API routes require `Authorization: Bearer <accessToken>`
3. When the access token expires, the client calls `POST /api/auth/refresh` (cookie sent automatically) → new access token returned
4. `POST /api/auth/logout` clears the refresh token cookie and invalidates it server-side (stored in a `refresh_tokens` DB table)

### Token storage
| Client | Access token | Refresh token |
|---|---|---|
| Web | In-memory (JS variable, not localStorage) | HttpOnly cookie (automatic) |
| Mobile | Expo SecureStore | Expo SecureStore |

Storing the access token in memory (not localStorage) on web prevents XSS token theft. The HttpOnly cookie for the refresh token prevents JS access entirely.

---

## CI/CD Pipeline

### Day-to-day commit workflow — `/commit` skill

The standard way to commit is via the `/commit` slash command in Claude Code. It enforces the following loop:

```
Claude makes code changes
  ↓
User types /commit
  ↓
Claude shows git diff --stat (you see exactly what's going out)
  ↓
Claude runs full test suite locally
  ↓
  ├── All pass → suggest commit message → user confirms → commit + push to main
  └── Any fail → Claude explains failures → fixes code → re-runs failing tests
                → asks user to confirm → commit + push to main
```

Available flags (can be combined):
- `--e2e` — also run Playwright end-to-end tests before committing
- `--apk-local` — after push, build an APK on this machine via `eas build --platform android --local`
- `--apk-cloud` — after push, trigger an EAS cloud APK build via `eas build --platform android`

The skill file lives at [.claude/commands/commit.md](.claude/commands/commit.md).

### GitHub Actions — safety net and deployment trigger

GitHub Actions runs on every push to `main`. Its job is to be the authoritative safety net (catches environment differences, flaky tests) and to trigger EC2 deployment if everything is green.

#### `ci.yml` — runs on every push and PR
```
1. Checkout code
2. Set up Node 22 + pnpm
3. Install dependencies
4. Type check (tsc --noEmit) across all apps
5. Lint (ESLint) across all apps
6. Start test MySQL container (GitHub Actions service container)
7. pnpm --filter api test
8. pnpm --filter web test
9. pnpm --filter stremio-addon test
10. Run Playwright E2E against a locally started dev server
```

#### `deploy.yml` — runs on push to `main` only, after `ci.yml` passes
```
1. Build Docker images for api, web, stremio-addon
2. Push images to GitHub Container Registry (GHCR)
3. SSH into EC2
4. docker compose pull
5. docker compose up -d --remove-orphans
```

### Secrets required in GitHub repository settings
```
EC2_HOST          # EC2 public IP or domain
EC2_USER          # SSH user (e.g. ubuntu)
EC2_SSH_KEY       # Private SSH key for EC2 access
GHCR_TOKEN        # GitHub token with packages:write scope
```

### Branch strategy
- `main` — production-ready; every push auto-deploys
- Work directly on `main` for solo development; use feature branches for anything experimental
- No staging environment (single-user personal app; EC2 is the only server)

---

## Testing Strategy

Every feature must ship with automated tests. This is non-negotiable — manual verification alone is not acceptable.

### Test Stack
| Layer | Tool |
|---|---|
| API unit + integration | Vitest + Supertest (tests hit a real MySQL test DB, no mocks) |
| Web components | Vitest + React Testing Library |
| Web E2E | Playwright |
| Mobile | Jest + React Native Testing Library |
| Stremio addon | Vitest |

### Test Structure per App
```
apps/api/
  src/
    routes/__tests__/        # Supertest integration tests per route group
    services/__tests__/      # Unit tests for TMDB client, scrobble parsers
  migrations/test-seed.sql   # Seed data for test DB

apps/web/
  src/
    app/__tests__/           # Page-level Playwright E2E tests
    components/__tests__/    # RTL unit tests per component

apps/mobile/
  src/
    screens/__tests__/       # RNTL tests per screen

apps/stremio-addon/
  src/__tests__/             # Vitest unit tests for manifest, scrobble handler
```

### Coverage Requirements
- All API endpoints must have at least one happy-path and one error-path Supertest test — including auth, history, progress, watchlist, watch-status, ratings, notes, and stats endpoints
- Auth flow must be tested: valid login returns tokens, expired access token is rejected, refresh token issues new access token, logout invalidates refresh token
- All scrobble parsers (Emby, Stremio) must have unit tests with real payload fixtures captured from each service
- Scrobble exclusion logic must be unit tested: excluded TMDB IDs are dropped, non-excluded IDs are written, per-integration scope is enforced
- Dashboard aggregation logic (stats, schedule, continue-watching) must be unit tested against seeded DB data
- Stats aggregation (all-time, year, month) must be unit tested against seeded watch history
- Each web page must have a Playwright smoke test that loads the page and asserts key elements are visible
- CI runs all tests on every push via GitHub Actions before deployment

### Test DB Setup
- A separate MySQL database (`trakt_test`) is spun up alongside the dev DB in Docker Compose
- `npm run test` in `apps/api` applies migrations to test DB, runs tests, tears down data
- Tests are isolated per file using `beforeEach` truncate + re-seed

---

## Verification Plan

### Per phase

**Phase 0 (MVP):** Log in → search for a show → view detail → mark an episode watched → confirm it appears in "Up Next" on the dashboard. All Phase 0 API and web tests pass.

**Phase 1:** Every web page loads without error in Playwright. All new API endpoints pass Supertest tests. Stats figures match manually seeded watch history rows.

**Phase 2:** Emby `PlaybackStopped` webhook → correct `watch_history` row → appears in dashboard "Recent". Stremio addon installs and manifest is reachable. Add a show to the Emby exclusion list → play it in Emby → no `watch_history` row created. Same for Stremio exclusion.

**Phase 3 (Production):** `https://yourdomain.com` loads the web app with valid TLS. Push a commit to `main` → GitHub Actions CI passes → EC2 pulls and restarts containers automatically.

**Phase 4 (Trakt import):** Run `pnpm --filter api import:trakt` → script completes without fatal errors → `/history` row count matches Trakt profile totals → spot-check 3–5 entries match → re-running the script adds 0 new rows (deduplication confirmed).

> Note: the import runs against the live production DB after Phase 3 deployment.

**Phase 5 (Polish):** Security headers present in all API responses. Rate limiting is active on `/api/auth/login`. Mobile app with TanStack Query caching loads and displays cached data when network is offline.

**Phase 6 (Mobile):** All mobile screens render in RNTL tests. APK builds locally via `eas build --platform android --local` and installs on a device. Auth, watch marking, and dashboard work end-to-end on mobile.

### Commands
```bash
pnpm --filter api test            # API + integration tests (real test DB)
pnpm --filter web test            # Web component tests (RTL)
pnpm --filter web test:e2e        # Playwright E2E
pnpm --filter mobile test         # RNTL screen tests
pnpm --filter stremio-addon test  # Stremio addon unit tests
```
