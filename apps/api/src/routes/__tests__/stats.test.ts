import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb, getPool } from '../../test/helpers';

const app = buildApp();

beforeAll(async () => { await app.ready(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await app.close(); await closePool(); });

async function getToken(): Promise<string> {
  const res = await supertest(app.server)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'correct_password' });
  return res.body.accessToken as string;
}

// Seed watch history: 3 episodes from show 1 and 2 movies watched on specific dates
async function seedWatchHistory() {
  const pool = getPool();
  const year = new Date().getFullYear();
  await pool.query(
    `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source) VALUES
     (1, 'episode', 1, '${year}-03-01 20:00:00', 100, 'manual'),
     (1, 'episode', 2, '${year}-03-02 20:00:00', 100, 'manual'),
     (1, 'movie',   1, '${year}-03-03 20:00:00', 100, 'manual'),
     (1, 'episode', 3, '${year}-04-10 20:00:00', 100, 'manual'),
     (1, 'movie',   2, '${year}-04-11 20:00:00', 100, 'manual')`,
  );
}

describe('GET /api/stats/alltime', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/stats/alltime');
    expect(res.status).toBe(401);
  });

  it('returns zero counts with no watch history', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/stats/alltime')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalMovies: 0, totalEpisodes: 0, totalShows: 0, totalMinutes: 0, longestStreak: 0,
    });
    expect(res.body.heatmap).toEqual([]);
  });

  it('returns correct counts for seeded history', async () => {
    await seedWatchHistory();
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/stats/alltime')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalMovies).toBe(2);
    expect(res.body.totalEpisodes).toBe(3);
    expect(res.body.totalShows).toBe(1); // all episodes from show 1
    expect(res.body.totalMinutes).toBeGreaterThan(0);
    expect(res.body.longestStreak).toBe(3); // March 1-3 are consecutive
    expect(res.body.heatmap.length).toBeGreaterThanOrEqual(5);
    expect(res.body.topShows).toHaveLength(1);
    expect(res.body.topShows[0]).toMatchObject({ title: 'Test Show Alpha', episodeCount: 3 });
  });
});

describe('GET /api/stats/year/:year', () => {
  it('returns 400 for invalid year', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/stats/year/abc')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns year stats matching seeded data', async () => {
    await seedWatchHistory();
    const token = await getToken();
    const year = new Date().getFullYear();
    const res = await supertest(app.server)
      .get(`/api/stats/year/${year}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.year).toBe(year);
    expect(res.body.totalMovies).toBe(2);
    expect(res.body.totalEpisodes).toBe(3);
    expect(res.body.monthlyBreakdown.length).toBeGreaterThanOrEqual(2);
  });

  it('returns zeros for a year with no data', async () => {
    await seedWatchHistory();
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/stats/year/2000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalMovies).toBe(0);
    expect(res.body.totalEpisodes).toBe(0);
  });
});

describe('GET /api/stats/month/:year/:month', () => {
  it('returns 400 for invalid month', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/stats/month/2024/13')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns month stats matching seeded data', async () => {
    await seedWatchHistory();
    const token = await getToken();
    const year = new Date().getFullYear();
    const res = await supertest(app.server)
      .get(`/api/stats/month/${year}/3`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalMovies).toBe(1);
    expect(res.body.totalEpisodes).toBe(2);
    expect(res.body.dailyBreakdown.length).toBeGreaterThanOrEqual(3);
    expect(res.body.movies).toHaveLength(1);
    expect(res.body.movies[0].title).toBe('Test Movie Alpha');
  });
});
