import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb } from '../../test/helpers';

const app = buildApp();

const TMDB_MOVIES = [
  {
    id: 550,
    title: 'Fight Club',
    release_date: '1999-10-15',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    overview: 'An insomniac...',
    vote_average: 8.4,
  },
];

const TMDB_SHOWS = [
  {
    id: 1396,
    name: 'Breaking Bad',
    first_air_date: '2008-01-20',
    poster_path: '/bb.jpg',
    backdrop_path: '/bb-bg.jpg',
    overview: 'A chemistry teacher...',
    vote_average: 8.9,
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
      json: async () => ({
        page: 1,
        total_pages: 10,
        total_results: 100,
        results: TMDB_MOVIES,
      }),
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

describe('GET /api/discover/movies', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/discover/movies');
    expect(res.status).toBe(401);
  });

  it('returns movie discovery results from TMDB', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/discover/movies?category=trending&page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      category: 'trending',
      period: 'all_time',
      page: 1,
      items: [{ tmdbId: 550, mediaType: 'movie', title: 'Fight Club', rating: 84 }],
    });
  });

  it('uses TMDB discover for top-rated period filters', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/discover/movies?category=top_rated&period=past_year')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const fetchMock = vi.mocked(fetch);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/3/discover/movie');
    expect(url.searchParams.get('sort_by')).toBe('vote_average.desc');
    expect(url.searchParams.get('primary_release_date.gte')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns 400 for invalid period', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/discover/movies?period=forever-ish')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('GET /api/discover/shows', () => {
  it('returns show discovery results from TMDB', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        page: 1,
        total_pages: 5,
        total_results: 50,
        results: TMDB_SHOWS,
      }),
    } as Response);

    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/discover/shows?category=popular&page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      category: 'popular',
      period: 'all_time',
      page: 1,
      items: [{ tmdbId: 1396, mediaType: 'show', title: 'Breaking Bad', rating: 89 }],
    });
  });
});

describe('Discover edge cases', () => {
  it('returns 400 for unknown movie category', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/discover/movies?category=not_a_real_category')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown show category', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/discover/shows?category=not_a_real_category')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('defaults page to 1 when not provided', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/discover/movies?category=trending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
  });

  it('returns 401 for shows without auth', async () => {
    const res = await supertest(app.server).get('/api/discover/shows');
    expect(res.status).toBe(401);
  });
});
