import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb } from '../../test/helpers';

const app = buildApp();

const TMDB_MOVIE = {
  id: 550,
  title: 'Fight Club',
  release_date: '1999-10-15',
  overview: 'An insomniac...',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  runtime: 139,
  genres: [{ id: 18, name: 'Drama' }],
  vote_average: 8.8,
};

beforeAll(async () => { await app.ready(); });
beforeEach(async () => {
  await resetDb();
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('external_ids')) {
      return Promise.resolve({ ok: true, json: async () => ({ imdb_id: 'tt0137523' }) });
    }
    return Promise.resolve({ ok: true, json: async () => TMDB_MOVIE });
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

describe('GET /api/movies/:tmdbId', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/movies/550');
    expect(res.status).toBe(401);
  });

  it('fetches from TMDB and caches movie', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/movies/550')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.movie).toMatchObject({ tmdbId: 550, title: 'Fight Club', year: 1999 });
    expect(res.body.status).toMatchObject({ inWatchlist: false, inCollection: false, watched: false });
  });

  it('returns cached movie on second call without hitting TMDB again', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/movies/550').set('Authorization', `Bearer ${token}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    (global.fetch as any).mockClear();
    await supertest(app.server).get('/api/movies/550').set('Authorization', `Bearer ${token}`);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('POST /api/movies/:tmdbId/watched', () => {
  it('marks movie as watched and reflects in status', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/movies/550').set('Authorization', `Bearer ${token}`);

    const watchRes = await supertest(app.server)
      .post('/api/movies/550/watched')
      .set('Authorization', `Bearer ${token}`);
    expect(watchRes.status).toBe(200);
    expect(watchRes.body.watched).toBe(true);

    const detailRes = await supertest(app.server)
      .get('/api/movies/550')
      .set('Authorization', `Bearer ${token}`);
    expect(detailRes.body.status.watched).toBe(true);
  });

  it('DELETE unmarks movie watched', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/movies/550').set('Authorization', `Bearer ${token}`);
    await supertest(app.server).post('/api/movies/550/watched').set('Authorization', `Bearer ${token}`);

    const res = await supertest(app.server)
      .delete('/api/movies/550/watched')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.watched).toBe(false);
  });
});

describe('POST/DELETE /api/movies/:tmdbId/watchlist', () => {
  it('toggles watchlist on and off', async () => {
    const token = await getToken();
    await supertest(app.server).get('/api/movies/550').set('Authorization', `Bearer ${token}`);

    const addRes = await supertest(app.server)
      .post('/api/movies/550/watchlist')
      .set('Authorization', `Bearer ${token}`);
    expect(addRes.body.inWatchlist).toBe(true);

    const removeRes = await supertest(app.server)
      .delete('/api/movies/550/watchlist')
      .set('Authorization', `Bearer ${token}`);
    expect(removeRes.body.inWatchlist).toBe(false);
  });
});
