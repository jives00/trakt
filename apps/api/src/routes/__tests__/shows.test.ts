import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb } from '../../test/helpers';

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
    expect(res.body.status).toMatchObject({ inWatchlist: false, inCollection: false });
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

describe('POST/DELETE /api/shows/:tmdbId/collection', () => {
  it('toggles show collection on and off', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/shows/1396').set('Authorization', `Bearer ${token}`);

    const addRes = await supertest(app.server)
      .post('/api/shows/1396/collection')
      .set('Authorization', `Bearer ${token}`);
    expect(addRes.status).toBe(200);
    expect(addRes.body.inCollection).toBe(true);

    const removeRes = await supertest(app.server)
      .delete('/api/shows/1396/collection')
      .set('Authorization', `Bearer ${token}`);
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.inCollection).toBe(false);
  });

  it('reflects collection status in show detail', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/shows/1396').set('Authorization', `Bearer ${token}`);

    await supertest(app.server)
      .post('/api/shows/1396/collection')
      .set('Authorization', `Bearer ${token}`);

    const detailRes = await supertest(app.server)
      .get('/api/shows/1396')
      .set('Authorization', `Bearer ${token}`);
    expect(detailRes.body.status.inCollection).toBe(true);
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
