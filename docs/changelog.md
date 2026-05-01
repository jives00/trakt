# Changelog

## May 1, 2026

### API
- Search route and TMDB client improvements, user-media service fixes `2282f7f`

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
