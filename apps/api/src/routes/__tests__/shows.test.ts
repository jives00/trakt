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

  it('fetches from TMDB and returns show with status', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/shows/1396')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.show).toMatchObject({ tmdbId: 1396, title: 'Breaking Bad', seasonCount: 5 });
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
