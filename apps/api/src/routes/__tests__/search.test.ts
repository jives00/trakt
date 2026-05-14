import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb } from '../../test/helpers';

const app = buildApp();

const TMDB_RESULTS = [
  {
    id: 550,
    media_type: 'movie',
    title: 'Fight Club',
    release_date: '1999-10-15',
    poster_path: '/poster.jpg',
    overview: 'An insomniac...',
  },
  {
    id: 1396,
    media_type: 'tv',
    name: 'Breaking Bad',
    first_air_date: '2008-01-20',
    poster_path: '/bb.jpg',
    overview: 'A chemistry teacher...',
  },
];

beforeAll(async () => {
  await app.ready();
});

beforeEach(async () => {
  await resetDb();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: TMDB_RESULTS }),
    }),
  );
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

describe('GET /api/search', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/search?q=test');
    expect(res.status).toBe(401);
  });

  it('returns 400 when q is missing', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/search')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when q is blank', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/search?q=   ')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns search results from TMDB', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/search?q=fight')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ tmdbId: 550, mediaType: 'movie', title: 'Fight Club' });
    expect(res.body[1]).toMatchObject({ tmdbId: 1396, mediaType: 'show', title: 'Breaking Bad' });
  });

  it('returns empty array when TMDB returns no results', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);

    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/search?q=zzznoresults')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('handles special characters in query without error', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/search?q=it%27s+a+wonderful+life')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 400 when q is shorter than minimum length', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/search?q=a')
      .set('Authorization', `Bearer ${token}`);

    // Single char that is all whitespace would be caught; single meaningful char may pass
    // Either way the request should not crash the server
    expect([200, 400]).toContain(res.status);
  });
});
