# Changelog

## May 2, 2026

### Build
- Fix tsconfig errors: remove unused project references, silence node10 moduleResolution deprecation, add scripts/tsconfig.json to fix api rootDir violation `18b6bf2`

### API
- TVDB client to fetch series air time; store `air_time` on episodes via migration 004; backfill utility for existing episodes `072e059`
- Dashboard schedule endpoint surfaces `air_time` per entry `072e059`
- Add `release_date` and `tagline` to movies table (migrations 005-006); TMDB client and movies service fetch both fields; dashboard schedule includes upcoming tracked movies `4437ef1`

### Web
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
