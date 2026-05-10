/**
 * Trakt.tv data preview script.
 * Authenticates via device-code flow, then dumps 2–3 sample records from each
 * endpoint the import script will use. Purpose: validate field mapping before
 * building the full import.
 *
 * Usage: pnpm --filter api tsx scripts/trakt-preview.ts
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// pnpm sets cwd to the package dir (apps/api); .env is two levels up at repo root
const envPath = path.resolve(process.cwd(), '../../.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Failed to load .env from:', envPath);
  process.exit(1);
}

const TRAKT_API = 'https://api.trakt.tv';
const CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'trakt-api-version': '2',
  'trakt-api-key': CLIENT_ID!,
  'Content-Type': 'application/json',
  'User-Agent': 'TraktClone/1.0 (+https://github.com/)',
});

// ── Auth ─────────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  console.log(`Using client_id: ${CLIENT_ID?.slice(0, 8)}... (${CLIENT_ID?.length} chars)`);

  const codeRes = await fetch(`${TRAKT_API}/oauth/device/code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID!,
      'User-Agent': 'TraktClone/1.0 (+https://github.com/)',
    },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });

  if (!codeRes.ok) {
    const body = await codeRes.text();
    throw new Error(`Device code request failed: ${codeRes.status} — ${body}`);
  }

  const code = (await codeRes.json()) as {
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  };

  console.log(`\nGo to: ${code.verification_url}`);
  console.log(`Enter code: ${code.user_code}`);
  console.log('Waiting for authorization...\n');

  const deadline = Date.now() + code.expires_in * 1000;

  while (Date.now() < deadline) {
    await sleep(code.interval * 1000);

    const tokenRes = await fetch(`${TRAKT_API}/oauth/device/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': CLIENT_ID!,
        'User-Agent': 'TraktClone/1.0 (+https://github.com/)',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code.device_code,
      }),
    });

    if (tokenRes.status === 200) {
      const token = (await tokenRes.json()) as { access_token: string };
      console.log('Authorized.\n');
      return token.access_token;
    }

    if (tokenRes.status !== 400) {
      throw new Error(`Unexpected token response: ${tokenRes.status}`);
    }
    // 400 = pending, keep polling
  }

  throw new Error('Authorization timed out');
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function get(token: string, path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${TRAKT_API}${path}`);
  Object.entries({ limit: '3', ...params }).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { headers: HEADERS(token) });

  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Display helpers ───────────────────────────────────────────────────────────

const OUTPUT_FILE = path.resolve(process.cwd(), 'trakt-preview.json');
const sections: Record<string, unknown> = {};
let currentSection = '';

function section(title: string) {
  currentSection = title;
  console.log(`Fetching: ${title}`);
}

function show(data: unknown) {
  sections[currentSection] = data;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const token = await getAccessToken();

  // 1. History — movies
  section('GET /users/me/history/movies (sample 3)');
  const historyMovies = await get(token, '/users/me/history/movies');
  show(historyMovies);

  // 2. History — episodes
  section('GET /users/me/history/episodes (sample 3)');
  const historyEpisodes = await get(token, '/users/me/history/episodes');
  show(historyEpisodes);

  // 3. Ratings — movies
  section('GET /users/me/ratings/movies (sample 3)');
  const ratingsMovies = await get(token, '/users/me/ratings/movies');
  show(ratingsMovies);

  // 4. Ratings — shows
  section('GET /users/me/ratings/shows (sample 3)');
  const ratingsShows = await get(token, '/users/me/ratings/shows');
  show(ratingsShows);

  // 5. Ratings — episodes
  section('GET /users/me/ratings/episodes (sample 3)');
  const ratingsEpisodes = await get(token, '/users/me/ratings/episodes');
  show(ratingsEpisodes);

  // 6. Watchlist — movies
  section('GET /users/me/watchlist/movies (sample 3)');
  const watchlistMovies = await get(token, '/users/me/watchlist/movies');
  show(watchlistMovies);

  // 7. Watchlist — shows
  section('GET /users/me/watchlist/shows (sample 3)');
  const watchlistShows = await get(token, '/users/me/watchlist/shows');
  show(watchlistShows);

  // 8. Collection — movies
  section('GET /users/me/collection/movies (sample 3)');
  const collectionMovies = await get(token, '/users/me/collection/movies');
  show(collectionMovies);

  // 9. Collection — shows
  section('GET /users/me/collection/shows (sample 3)');
  const collectionShows = await get(token, '/users/me/collection/shows');
  show(collectionShows);

  // 10. Lists (index)
  section('GET /users/me/lists');
  const lists = await get(token, '/users/me/lists');
  show(lists);

  // 11. First list's items (if any lists exist)
  const listArr = lists as Array<{ ids: { slug: string }; name: string }>;
  if (listArr.length > 0) {
    const slug = listArr[0].ids.slug;
    section(`GET /users/me/lists/${slug}/items (sample 3 from "${listArr[0].name}")`);
    const listItems = await get(token, `/users/me/lists/${slug}/items`);
    show(listItems);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sections, null, 2), 'utf-8');
  console.log(`\nOutput written to: ${OUTPUT_FILE}`);
  console.log('\nKey things to check:');
  console.log('  history/movies    → ids.tmdb present?');
  console.log('  history/episodes  → episode.ids.tmdb present? season/number fields?');
  console.log('  collection/shows  → per-show or per-episode granularity?');
  console.log('  list items        → ids.tmdb present on both movies and shows?');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
