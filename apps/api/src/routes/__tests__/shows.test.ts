import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb, getPool } from '../../test/helpers';

const app = buildApp();

const TMDB_SHOW = {
  id: 1396,
  name: 'Breaking Bad',
  first_air_date: '2008-01-20',
  overview: 'Chemistry teacher...',
  poster_path: '/bb.jpg',
  backdrop_path: '/bb-bg.jpg',
  status: 'Ended',
  networks: [{ id: 174, name: 'AMC' }],
  genres: [{ id: 18, name: 'Drama' }],
  number_of_seasons: 5,
  origin_country: ['US'],
  original_language: 'en',
  episode_run_time: [47],
};

const TMDB_CAST = {
  cast: [
    { id: 17419, name: 'Bryan Cranston', profile_path: '/bc.jpg', roles: [{ character: 'Walter White', episode_count: 62 }], total_episode_count: 62, order: 0 },
    { id: 84497, name: 'Aaron Paul', profile_path: '/ap.jpg', roles: [{ character: 'Jesse Pinkman', episode_count: 62 }], total_episode_count: 62, order: 1 },
    { id: 99999, name: 'Guest Actor', profile_path: null, roles: [{ character: 'Stranger', episode_count: 1 }], total_episode_count: 1, order: 50 },
  ],
};

const TMDB_SEASON = {
  season_number: 1,
  episode_count: 7,
  poster_path: null,
  air_date: '2008-01-20',
  episodes: [
    { episode_number: 1, name: 'Pilot', overview: null, still_path: null, air_date: '2008-01-20', runtime: 58 },
    { episode_number: 2, name: 'Cat\'s in the Bag', overview: null, still_path: null, air_date: '2008-01-27', runtime: 48 },
  ],
};

beforeAll(async () => { await app.ready(); });
beforeEach(async () => {
  await resetDb();
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/aggregate_credits')) {
      return Promise.resolve({ ok: true, json: async () => TMDB_CAST });
    }
    if (url.includes('/season/')) {
      return Promise.resolve({ ok: true, json: async () => TMDB_SEASON });
    }
    return Promise.resolve({ ok: true, json: async () => TMDB_SHOW });
  }));
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await app.close();
  await closePool();
});

async function getToken(): Promise<string> {
  const res = await supertest(app.server)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'correct_password' });
  return res.body.accessToken as string;
}

describe('GET /api/shows/:tmdbId', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/shows/1396');
    expect(res.status).toBe(401);
  });

  it('fetches from TMDB and returns show with status and metadata', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/shows/1396')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.show).toMatchObject({
      tmdbId: 1396, title: 'Breaking Bad', seasonCount: 5,
      firstAirDate: '2008-01-20', originCountry: 'US', originalLanguage: 'en', runtimeMin: 47,
    });
    expect(res.body.status).toMatchObject({ inWatchlist: false, inDropped: false, inRewatch: false, watched: false });
  });
});

describe('GET /api/shows/:tmdbId/seasons/:season', () => {
  it('returns episodes with internal ids', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/shows/1396').set('Authorization', `Bearer ${token}`);

    const res = await supertest(app.server)
      .get('/api/shows/1396/seasons/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.episodes).toHaveLength(2);
    expect(res.body.episodes[0]).toMatchObject({ episodeNumber: 1, title: 'Pilot', id: expect.any(Number) });
  });
});

describe('POST /api/shows/:tmdbId/seasons/:season/episodes/:ep/watched', () => {
  it('marks episode watched and appears in watchedEpisodeIds', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/shows/1396').set('Authorization', `Bearer ${token}`);
    await supertest(app.server).get('/api/shows/1396/seasons/1').set('Authorization', `Bearer ${token}`);

    const res = await supertest(app.server)
      .post('/api/shows/1396/seasons/1/episodes/1/watched')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.watched).toBe(true);

    const detailRes = await supertest(app.server)
      .get('/api/shows/1396/seasons/1')
      .set('Authorization', `Bearer ${token}`);
    expect(detailRes.body.watchedEpisodeIds).toContain(res.body.episodeId);
  });
});

describe('POST/DELETE /api/shows/:tmdbId/watchlist', () => {
  it('toggles show watchlist', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/shows/1396').set('Authorization', `Bearer ${token}`);

    const addRes = await supertest(app.server)
      .post('/api/shows/1396/watchlist')
      .set('Authorization', `Bearer ${token}`);
    expect(addRes.body.inWatchlist).toBe(true);

    const removeRes = await supertest(app.server)
      .delete('/api/shows/1396/watchlist')
      .set('Authorization', `Bearer ${token}`);
    expect(removeRes.body.inWatchlist).toBe(false);
  });
});

describe('POST /api/shows/:tmdbId/dropped', () => {
  it('toggles dropped and reflects in status', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/shows/1396').set('Authorization', `Bearer ${token}`);

    const dropRes = await supertest(app.server)
      .post('/api/shows/1396/dropped')
      .set('Authorization', `Bearer ${token}`);
    expect(dropRes.status).toBe(200);
    expect(dropRes.body.inDropped).toBe(true);

    const detailRes = await supertest(app.server)
      .get('/api/shows/1396')
      .set('Authorization', `Bearer ${token}`);
    expect(detailRes.body.status.inDropped).toBe(true);

    const undropRes = await supertest(app.server)
      .post('/api/shows/1396/dropped')
      .set('Authorization', `Bearer ${token}`);
    expect(undropRes.body.inDropped).toBe(false);
  });
});

describe('GET /api/shows/:tmdbId/cast', () => {
  it('returns cast fetched from TMDB and cached', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/shows/1396').set('Authorization', `Bearer ${token}`);

    const res = await supertest(app.server)
      .get('/api/shows/1396/cast')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cast).toHaveLength(3);
    const cranston = res.body.cast.find((m: any) => m.name === 'Bryan Cranston');
    expect(cranston).toMatchObject({ character: 'Walter White', episodeCount: 62, isRegular: true });
    const guest = res.body.cast.find((m: any) => m.name === 'Guest Actor');
    expect(guest).toMatchObject({ episodeCount: 1, isRegular: false });
  });

  it('serves cast from DB on second call without hitting aggregate_credits again', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/shows/1396').set('Authorization', `Bearer ${token}`);
    await supertest(app.server).get('/api/shows/1396/cast').set('Authorization', `Bearer ${token}`);

    const fetchMock = vi.mocked(globalThis.fetch);
    const callsBefore = fetchMock.mock.calls.length;
    await supertest(app.server).get('/api/shows/1396/cast').set('Authorization', `Bearer ${token}`);

    const newAggregateCalls = fetchMock.mock.calls
      .slice(callsBefore)
      .filter(([url]) => (url as string).includes('/aggregate_credits'));
    expect(newAggregateCalls).toHaveLength(0);
  });
});

describe('POST /api/shows/:tmdbId/cast/refresh', () => {
  it('refreshes cast from TMDB using batched queries', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/shows/1396').set('Authorization', `Bearer ${token}`);
    await supertest(app.server).get('/api/shows/1396/cast').set('Authorization', `Bearer ${token}`);

    const res = await supertest(app.server)
      .post('/api/shows/1396/cast/refresh')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cast).toHaveLength(3);
    const cranston = res.body.cast.find((m: any) => m.name === 'Bryan Cranston');
    expect(cranston).toMatchObject({ character: 'Walter White', episodeCount: 62 });
  });
});

describe('GET /api/shows/:tmdbId/up-next', () => {
  it('returns first episode when nothing watched', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/shows/91001/up-next')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.episode).toMatchObject({ seasonNumber: 1, episodeNumber: 1, title: 'Pilot' });
  });

  it('returns next episode after last watched', async () => {
    const token = await getToken();
    await supertest(app.server)
      .post('/api/shows/91001/seasons/1/episodes/1/watched')
      .set('Authorization', `Bearer ${token}`);

    const res = await supertest(app.server)
      .get('/api/shows/91001/up-next')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.episode).toMatchObject({ seasonNumber: 1, episodeNumber: 2 });
  });

  it('returns null when all episodes watched', async () => {
    const token = await getToken();
    for (const [s, e] of [[1,1],[1,2],[1,3],[2,1],[2,2],[2,3]]) {
      await supertest(app.server)
        .post(`/api/shows/91001/seasons/${s}/episodes/${e}/watched`)
        .set('Authorization', `Bearer ${token}`);
    }

    const res = await supertest(app.server)
      .get('/api/shows/91001/up-next')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.episode).toBeNull();
  });
});

describe('GET /api/shows/:tmdbId/recent-episodes', () => {
  it('returns the 2 most recently aired episodes in descending order', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/shows/91001/recent-episodes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.episodes).toHaveLength(2);
    expect(res.body.episodes[0]).toMatchObject({ seasonNumber: 2, episodeNumber: 3 });
    expect(res.body.episodes[1]).toMatchObject({ seasonNumber: 2, episodeNumber: 2 });
  });

  it('returns empty array for unknown show', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/shows/99999/recent-episodes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.episodes).toHaveLength(0);
  });
});

describe('Watchlist auto-removal', () => {
  // Seed: show 91001 (Ended, 6 episodes S1E1-3 + S2E1-3), show 91002 (Returning Series, 2 episodes)
  // Insert watchlist items directly to bypass POST /watchlist's prefetchAllSeasons side-effect,
  // which adds TMDB mock seasons/episodes that would prevent the "all watched" condition.

  it('removes ended show from watchlist when all episodes watched', async () => {
    const pool = getPool();
    const token = await getToken();
    // Load show into DB so it has fresh metadata (status='Ended' from TMDB mock)
    await supertest(app.server).get('/api/shows/91001').set('Authorization', `Bearer ${token}`);
    const [shows] = await pool.query<any[]>('SELECT id FROM tv_shows WHERE tmdb_id = 91001');
    await pool.query('INSERT INTO list_items (list_id, media_type, media_id) VALUES (1, "show", ?)', [shows[0].id]);

    // Bulk-mark all episodes watched (awaits checkShowWatchlistCompletion before responding)
    const watchRes = await supertest(app.server).post('/api/shows/91001/watched').set('Authorization', `Bearer ${token}`);
    expect(watchRes.status).toBe(200);

    const after = await supertest(app.server).get('/api/shows/91001').set('Authorization', `Bearer ${token}`);
    expect(after.body.status.inWatchlist).toBe(false);
    expect(after.body.status.watched).toBe(true);
  });

  it('does NOT remove ended show from watchlist when not all episodes watched', async () => {
    const pool = getPool();
    const token = await getToken();
    await supertest(app.server).get('/api/shows/91001').set('Authorization', `Bearer ${token}`);
    const [shows] = await pool.query<any[]>('SELECT id FROM tv_shows WHERE tmdb_id = 91001');
    await pool.query('INSERT INTO list_items (list_id, media_type, media_id) VALUES (1, "show", ?)', [shows[0].id]);

    // Mark 5 of 6 seed episodes (skip S2E3)
    for (const [s, e] of [[1,1],[1,2],[1,3],[2,1],[2,2]]) {
      await supertest(app.server)
        .post(`/api/shows/91001/seasons/${s}/episodes/${e}/watched`)
        .set('Authorization', `Bearer ${token}`);
    }

    const status = await supertest(app.server).get('/api/shows/91001').set('Authorization', `Bearer ${token}`);
    expect(status.body.status.inWatchlist).toBe(true);
  });

  it('does NOT remove returning series from watchlist when all episodes watched', async () => {
    const pool = getPool();
    // Freeze metadata so getOrFetchShow won't overwrite 'Returning Series' with 'Ended' from TMDB mock
    await pool.query('UPDATE tv_shows SET metadata_refreshed_at = NOW() WHERE tmdb_id = 91002');
    const [shows] = await pool.query<any[]>('SELECT id FROM tv_shows WHERE tmdb_id = 91002');
    await pool.query('INSERT INTO list_items (list_id, media_type, media_id) VALUES (1, "show", ?)', [shows[0].id]);

    const token = await getToken();
    await supertest(app.server).post('/api/shows/91002/watched').set('Authorization', `Bearer ${token}`);

    const status = await supertest(app.server).get('/api/shows/91002').set('Authorization', `Bearer ${token}`);
    expect(status.body.status.inWatchlist).toBe(true);
  });
});
