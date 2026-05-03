# Changelog

## May 3, 2026

### API
- Split oversized service files: stats.service → stats-helpers + stats-summary; dashboard.service → up-next + schedule; tmdb.client → tmdb-movies + tmdb-shows `3fac6b9`
- Add image override picker: migration 008 adds media_image_overrides table (show+movie); GET /shows/:id/images fetches TMDB backdrop/poster options; PUT /shows/:id/image saves override; applyImageOverrides applied in getOrFetchShow; batchApplyImageOverrides applied in getUpNext, getSchedule, getRecentItems `ac2c917`
- Add POST/DELETE /shows/:tmdbId/watched for bulk marking all episodes watched/unwatched; extend ShowStatus with watched flag `6d96737`

### Web
- Show detail page: hover edit button on hero backdrop and poster opens TMDB image picker modal; selected image saves as override and updates page immediately `ac2c917`
- Image picker modal: larger poster thumbnails (2→3→4 col grid), Escape key closes modal `771dfca`

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
