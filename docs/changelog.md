# Changelog

## May 8, 2026

### API
- Now playing tracking: new now_playing table stores active scrobble session (media_type, media_id, progress_pct, source, updated_at); UNIQUE constraint on user_id (single session); 5-min staleness guard via updated_at check; updateNowPlaying() and clearNowPlaying() functions called by all scrobble sources `c6d014c`
- GET /api/scrobble/now-playing endpoint joins movie/episode/show/season metadata to return NowPlayingItem; returns 204 if nothing playing; JWT-protected `c6d014c`
- Emby scrobbling: restructured handleEmbyScrobble to call updateNowPlaying before watch threshold check (fires at 0% progress); clearNowPlaying on PlaybackStopped event `c6d014c`
- Stremio polling: integrated updateNowPlaying into poll loop (every 60s regardless of threshold); clearNowPlaying on 204 response and 4h safety timeout `c6d014c`
- Stremio polling: continue polling on 204 until at least one 200 response is seen; prevents premature loop termination before Trakt registers the stream (10+ min lag) `6540863`
- Stremio polling: stop all existing poll loops when starting a new one to prevent parallel loops writing conflicting now_playing data `70faa93`
- Trakt API fix: changed User-Agent to Mozilla-compatible format and added Accept/Accept-Encoding headers to bypass Cloudflare 403 blocks on polling requests `48d6144`
- Trakt API headers: added realistic browser headers (Cache-Control, Pragma, Sec-Fetch-*) to match legitimate client patterns and bypass Cloudflare detection `5112cc6`
- Trakt API polling: switched from fetch to native https module with minimal curl-like headers to resolve Cloudflare 403 blocks `1c3fa76`
- Trakt API: added guard for missing TRAKT_CLIENT_ID environment variable to prevent header value errors `223c744`

### Build
- docker-compose.yml: added TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET to api service environment so Stremio polling OAuth tokens are available `e8c00e8`

### Web
- Now playing hero: dashboard hero conditionally renders NowPlayingHero when media is actively playing; shows backdrop/still image, title (linked to detail page), episode number/name (linked to episode detail), and progress bar `c6d014c`
- Progress bar displays percentage and computed time watched/remaining using progressPct × runtimeMin; updates every 30s via polling GET /api/scrobble/now-playing `c6d014c`
- Hero links: movie title links to /movies/:tmdbId; show title links to /shows/:tmdbId; episode info links to /shows/:tmdbId/seasons/:seasonNumber/episodes/:episodeNumber; hover effects fade/brighten text per site design `c6d014c`
- Now playing hero: use show backdrop instead of episode still as background image for episodes `a7dc828`

## May 7, 2026

### API
- Movie image endpoints: GET /api/movies/{tmdbId}/images and PUT /api/movies/{tmdbId}/image to fetch available backdrop/poster images and set custom overrides (same pattern as show endpoints) `dd51aa8`
- IMDb and TMDB ratings: OMDB client fetches IMDb ratings by IMDb ID; TMDB vote_average extracted on fetch; both cached in rt_critic_score column (IMDb) and tmdb_rating column; lazy backfill for existing movies/shows; migrations 016 and 017 add columns to both movies and tv_shows tables `1343557`

### Web
- Movie detail pages: add cast loading skeleton with loading state; fix race condition by fetching cast after movie is inserted into database; add hero backdrop and poster image edit buttons with image picker modal `dd51aa8`
- Image picker modal: accept mediaType prop to support both show and movie queries; use appropriate API methods (getShowImages/setShowImage vs getMovieImages/setMovieImage) `dd51aa8`
- Episode detail pages: add left/right arrow key navigation to browse episodes; add < > buttons in hero image for click-based navigation; wrap to previous/next season at boundaries; remove duplicate episode description from main content; move metadata above still image `671108d`
- Show season pages: remove collect/watchlist buttons and star ratings (show-level only); watched button toggles entire season; display "Partially Watched" when some episodes are watched `693c305`
- Show series pages: calculate and display "Partially Watched" when series has watched episodes but not all; fetch watched counts for all seasons to determine full status `693c305`
- Detail page sidebar ratings: display IMDb (from OMDB) and TMDB (from TMDB) ratings side-by-side in sidebar below user star ratings; add "View on IMDb" button next to "View on TMDB" button below refresh section; reorganized sidebar layout to group ratings together `1343557`

## May 6, 2026

### API
- Movie metadata and credits: add origin_country, original_language, production_company columns; new endpoints GET /api/movies/{tmdbId}/cast and /crew fetch from TMDB and cache in credits table; fetchMovieCredits() returns cast and crew members with profile photos; crew filtered to key roles (Director, Writer, Producer, Cinematographer, Editor, Composer, Designer, Sound) `7a05a0d`
- Recommendation diversity: collect all recommendations from all 5 seed shows/movies, then randomly sample 3 instead of stopping at first 3 `cbe3239`
- Stremio scrobbling fix: store Trakt username during OAuth (fetch from /users/me after auth); use stored username to poll /users/{username}/watching; calculate progress % from started_at/expires_at elapsed time (Trakt API doesn't return progress field); allow all CORS origins since sensitive endpoints are JWT-protected `a218d13`
- Trakt OAuth device-code flow: initiateDeviceCodeFlow() and checkAuthorizationStatus() for interactive authorization; caches device code in memory with expiry; stores tokens in trakt_tokens table on user approval; auto-refreshes tokens on expiry `64efc9a`
- Emby scrobbling service: handleEmbyScrobble() parses webhook payloads, calculates progress %, applies watch thresholds (80% movie, 70% episode), checks scrobble_exclusions, upserts to watch_history with same-day dedup on (user_id, media_type, media_id, DATE) `64efc9a`
- Stremio addon routes: GET /stremio-addon/manifest.json returns addon metadata; GET /stremio-addon/subtitles/{type}/{id}/{extra}.json validates IMDB ID format and starts background poll loop `64efc9a`
- Scrobble exclusion system: POST/GET/DELETE /api/settings/exclusions endpoints with per-integration title exclusions; Zod schemas for Emby, Stremio, Kodi payloads `64efc9a`
- Settings endpoints: GET /api/settings/api-key returns scrobbleApiKey; GET /api/settings/trakt-auth returns connection status; POST routes to initiate and check Trakt OAuth flow `64efc9a`
- Trakt API requests now include User-Agent header to bypass Cloudflare blocks; token refresh endpoint handles 409 (code expired) as expected state `64efc9a`
- Database pool initialization: production services now import from db.ts instead of test helpers to correctly read .env configuration; fixes port configuration issues `64efc9a`
- Refresh endpoints: POST /api/movies/{id}/metadata/refresh, POST /api/movies/{id}/cast/refresh for movies; POST /api/shows/{id}/metadata/refresh, POST /api/shows/{id}/seasons/refresh, POST /api/shows/{id}/seasons/{season}/episodes/refresh for shows; force-refresh clears cached data and re-fetches from TMDB `8548c0f`

### Web
- Movie detail pages: full redesign with hero (backdrop, poster, genres, title, overview), metadata row (Premiered, Runtime, Country, Language, Studio), cast/crew tabs with profile photos and placeholder icons, sidebar with watchlist/collection/watched toggles, 1-10 star rating, TMDB link `7a05a0d`
- Integrations page: add Trakt OAuth modal with device code display (copyable) and https://trakt.tv/activate URL; 2-second polling for authorization status `64efc9a`
- Trakt connection button: "Connect Trakt" initiates device code flow; displays "✓ Trakt Connected" when authorized; auto-closes modal on successful auth `64efc9a`
- Exclusion UI: per-integration exclusion list with title display, media type badge, and remove button; refetches after deletion `64efc9a`
- API key display: fetch from GET /api/settings/api-key with toggle visibility button; shows masked by default `64efc9a`
- Auth fix: all authenticated API calls now include Authorization Bearer token from useAuth() hook stored in memory; useMemo prevents infinite fetch loops `64efc9a`
- Refresh data button: add split-button component to movie/show/season/episode sidebars; main action refreshes all data, dropdown lists section-specific options (metadata, cast, seasons, episodes); auto-prefetch seasons on show page load if empty; loading indicators with skeleton loaders for cast and seasons `8548c0f`

## May 5, 2026

### API
- Fix duplicate cast members: add UNIQUE constraint to credits table on (media_type, media_id, person_id, role); use INSERT ... ON DUPLICATE KEY UPDATE to prevent inserting same person multiple times with different is_regular values; add DISTINCT to cast SELECT query as safety measure `24b5455`

### Web
- Up Next and Schedule sections: split navigation so show names navigate to show page while episode number/title/poster navigate to episode detail page `0215657`
- Up Next: navigation arrows conditionally appear only when items exceed page width; display logic based on scroll state `0215657`
- Recommendations: remove glass-panel background, remove Browse link, add red vertical accent line to section header `0215657`
- Cast members now clickable on show, season, and episode pages: opening their TMDB person page in a new tab with hover effects (border/image scale/text color) `be7159d`
- Up Next: improved fade-in/fade-out animations with proper state tracking for removed cards; Schedule: fixed initial image load animation `5d78aa5`

## May 4, 2026

### API
- Use TMDB's native season/episode credits endpoints for cast distinction: fetch series regulars from /tv/{id}/season/{season}/credits, episode guest stars from /tv/{id}/season/{season}/episode/{ep}/credits; removes complex logic trying to infer regular vs guest status; episode cast now uses TMDB's actual designations for accuracy `8c6b262`
- Change series regular determination: mark top 12 cast members as regulars (by cast order) instead of top 15 with 3+ episodes requirement; simplifies logic to rely on TMDB's cast ordering `8c6b262`
- Add forceRefreshShowCast to clear cached cast data before re-fetching; fixes refresh button to actually update stale cast data instead of returning cached results `8c6b262`

### Web
- Episode detail page: add manual refresh button for cast data; clicking refreshes from TMDB and refetches episode cast so regulars/guests distinction updates immediately `8c6b262`
- Up-next section: fix test to expect episode detail link instead of show detail link `8c6b262`

## May 3, 2026

### API
- Auto-refresh stale season metadata: seasons < 60 days old use 1-day TTL, older seasons 7-day TTL; on access via season detail or show page recent episodes, stale seasons re-fetch from TMDB and upsert episode fields (still, overview, air date) so images and descriptions that fill in after air date appear automatically; migration 009 adds fetched_at to seasons `c0d38ff`
- Split oversized service files: stats.service → stats-helpers + stats-summary; dashboard.service → up-next + schedule; tmdb.client → tmdb-movies + tmdb-shows `3fac6b9`
- Add image override picker: migration 008 adds media_image_overrides table (show+movie); GET /shows/:id/images fetches TMDB backdrop/poster options; PUT /shows/:id/image saves override; applyImageOverrides applied in getOrFetchShow; batchApplyImageOverrides applied in getUpNext, getSchedule, getRecentItems `ac2c917`
- Add POST/DELETE /shows/:tmdbId/watched for bulk marking all episodes watched/unwatched; extend ShowStatus with watched flag `6d96737`

### Web
- Show detail page: hover edit button on hero backdrop and poster opens TMDB image picker modal; selected image saves as override and updates page immediately `ac2c917`
- Image picker modal: larger poster thumbnails (2→3→4 col grid), Escape key closes modal `771dfca`
- Schedule section: poster images link to the show/movie detail page `bd62f50`
- Season detail pages: /shows/[tmdbId]/seasons/[n] with hero (season poster), show metadata, episode list with still images, descriptions, air dates, and watch toggles; /shows/[tmdbId]/seasons/all shows all seasons with infinite scroll; EpisodeItem type gains overview field `36ba0a2`

### Web
- Show detail page: replace season accordion with poster grid linking to season detail; add GET /shows/:tmdbId/seasons endpoint returning season summaries `6c70e46`
- Show detail page: remove watchlist/collection from hero, move status to metadata section, add full-width Mark Watched toggle to sidebar, remove year/seasons sidebar rows `6d96737`
- Show detail page: square image corners, top-align hero backdrop `d6a00ee`
- Add DESIGN.md with visual identity, color palette, and UI/UX principles `eff5fb4`

## May 2, 2026

### API
- Add /cast, /up-next, /recent-episodes show routes; fetchShowCast from TMDB aggregate_credits; getShowUpNext and getShowRecentEpisodes services; migration 007 for metadata/cast columns; dateStrings: true fix for DATE columns `2093eed`
- Fix up-next query to surface episode after most recently watched, not globally lowest unwatched `67b3a3c`

### Web
- Show detail page redesign: metadata grid, episode highlights (Up Next + 2 recently aired), cast tabs (Series Regulars / Guest Stars), overflow-x-hidden hero fix, runtime fallback from episodes table `2093eed`
- Add episode detail pages at /shows/{id}/seasons/{n}/episodes/{ep}: full episode metadata with hero, still image, description, and cast (guest stars + series regulars); episode cast live-fetched from TMDB; pages linked from all episode entry points (show detail up next/recently aired cards, dashboard up next section, recently watched section, season detail episode list); API adds fetchEpisodeCredits, getEpisodeDetail, getEpisodeCast; web updates EpisodeThumb, UpNextCard, RecentCard to link to episode detail `46424c1`

### Web
- Schedule section: increase divider padding between same-day entries `67b3a3c`
- Recently watched: change season/episode label color from red to white `67b3a3c`
- Hero background: lighten brightness from 0.6 to 0.8 `67b3a3c`
- Fix schedule-section test timezone bug (use local date parts instead of toISOString) `67b3a3c`

### API
- Recommendations service: seed from recent watch history, call TMDB recommendations, deduplicate, filter already-watched; two new dashboard routes for shows and movies `e5cbad2`
- Recently watched query returns episode `still_path` and movie `tagline` `e5cbad2`
- Add `fetchMovieRecommendations` and `fetchShowRecommendations` to TMDB client `e5cbad2`

### Web
- Show/movie recommendations panels on dashboard with horizontal poster grid (3 items each) `e5cbad2`
- Recently watched uses episode still image instead of series poster; movie tagline shown under title `e5cbad2`
- Genre bar replaced with segmented hover bar + per-segment tooltip + flex-wrap legend; bar is taller `e5cbad2`
- Rounded corners removed from all art across dashboard (recent cards, up-next posters, schedule posters) `e5cbad2`
- Recently watched reduced to 3 items (one row) `e5cbad2`
- Fix schedule section date header font size inconsistency (poster-pair columns now match standalone columns) `30eaebb`

### Build
- Fix tsconfig errors: remove unused project references, silence node10 moduleResolution deprecation, add scripts/tsconfig.json to fix api rootDir violation `18b6bf2`

### API
- Dashboard stats endpoint returns `{ daily, summary, genres }` instead of a bare array; per-day episode/movie counts; 30-day genre aggregation with show deduplication `dac5a0e`
- TVDB client to fetch series air time; store `air_time` on episodes via migration 004; backfill utility for existing episodes `072e059`
- Dashboard schedule endpoint surfaces `air_time` per entry `072e059`
- Add `release_date` and `tagline` to movies table (migrations 005-006); TMDB client and movies service fetch both fields; dashboard schedule includes upcoming tracked movies `4437ef1`

### Web
- Last 30 Days: full 30-day bar chart (US Central, missing days = 0), grey/red hover bars, watch-time sub-header, rich per-day tooltip, segmented genre bar with colored vertical lines `dac5a0e`
- Schedule section redesigned: 5-day window, poster columns for first two days, air time display `072e059`
- Schedule section renders movie entries with tagline; fix schedule window test to reflect 30-day/5-day-content model `4437ef1`

## May 1, 2026

### Build
- Root tsconfig with workspace references for monorepo; api and types packages extend from root config `f18e75f`

### API
- User profile endpoints (GET/PATCH) for managing display name `17350ea`
- Search route and TMDB client improvements, user-media service fixes `2282f7f`
- Dashboard up-next endpoint improvements with episode count tracking `493e5a1`

### Web
- Add user display name field to settings; use display name in dashboard greeting instead of user ID `17350ea`
- Add --skip-tests flag to /commit command; add public assets `5ae8364`
- Fix search results auto-execution when navigating from top nav; fix ScheduleSection timezone handling for local 'Today' label `78b2138`
- Dashboard hero banner full-width; improve top nav separator line styling `d6e3140`
- Up-next section with card-based design, progress tracking, and mark-as-watched functionality `493e5a1`

## April 30, 2026

### Web
- Search results page with featured section and paginated grid, dashboard with stats/recent activity, show/movie detail pages, episode tracking, side nav `f497545`

## April 29, 2026

### API
- Phase 1 routes: history, progress, collection, watchlist, lists, ratings, stats (alltime/year/month), dashboard recent + stats — 92/92 tests passing `f11756d`
- Fix `ONLY_FULL_GROUP_BY` errors in stats/dashboard GROUP BY clauses; replace `CROSS JOIN LATERAL JSON_TABLE` genre query with JS-side aggregation for MySQL compatibility `f11756d`
- Fix `resetDb()` race condition: switch `TRUNCATE` → `DELETE FROM` so auto_increment doesn't reset and prefetchAllSeasons inserts never collide with seed explicit IDs `f11756d`
- Fix timezone-sensitive schedule test: seed episode dates with `CURDATE()` SQL instead of JS UTC `toISOString()` `f11756d`
- Shows/movies/dashboard routes, user-media service (watchlist, collection, watched), auth middleware fix, shows integration tests `4fb4fb6`

### Web
- Dashboard page, movie/show detail pages, auth-context, web component tests for all pages; fix `vi.mock` → `vi.doMock` in per-test module mocking `4fb4fb6`

## April 28, 2026

### API
- Fastify server with auth (JWT + refresh cookie), movies, shows, search, and dashboard routes; full Vitest integration test suite hitting `trakt_test` MySQL; DB migrations and `migrate.ts` script `10bed36`

### Web
- Next.js 14 App Router scaffold with login, search, movie/show detail pages, top-nav, up-next and schedule sections, and Vitest component tests `10bed36`
