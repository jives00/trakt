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

async function seedShowData() {
  const pool = getPool();
  const [show] = await pool.query<any>(
    `INSERT INTO tv_shows (tmdb_id, title, year, overview, poster_path, genres)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [9999, 'Test Show', 2024, 'A test show', '/poster.jpg', '["Drama"]'],
  );
  const showId = show.insertId;

  const [season] = await pool.query<any>(
    `INSERT INTO seasons (show_id, season_number, episode_count) VALUES (?, 1, 3)`,
    [showId],
  );
  const seasonId = season.insertId;

  const [ep1] = await pool.query<any>(
    `INSERT INTO episodes (show_id, season_id, episode_number, title, air_date)
     VALUES (?, ?, 1, 'Pilot', CURDATE())`, [showId, seasonId],
  );
  const [ep2] = await pool.query<any>(
    `INSERT INTO episodes (show_id, season_id, episode_number, title, air_date)
     VALUES (?, ?, 2, 'Episode 2', DATE_ADD(CURDATE(), INTERVAL 1 DAY))`, [showId, seasonId],
  );
  await pool.query<any>(
    `INSERT INTO episodes (show_id, season_id, episode_number, title, air_date)
     VALUES (?, ?, 3, 'Episode 3', DATE_ADD(CURDATE(), INTERVAL 3 DAY))`, [showId, seasonId],
  );

  await pool.query(
    `INSERT INTO watchlist (user_id, media_type, media_id) VALUES (1, 'show', ?)`, [showId],
  );

  await pool.query(
    `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source)
     VALUES (1, 'episode', ?, NOW(), 100, 'manual')`, [ep1.insertId],
  );

  return { showId, seasonId, ep1Id: ep1.insertId, ep2Id: ep2.insertId };
}

describe('GET /api/dashboard/up-next', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/dashboard/up-next');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no shows tracked', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/dashboard/up-next')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns next unwatched episode per show', async () => {
    const { ep2Id } = await seedShowData();
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/dashboard/up-next')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      showTitle: 'Test Show',
      seasonNumber: 1,
      episodeNumber: 2,
      episodeId: ep2Id,
    });
  });

  it('excludes shows with no watched episodes', async () => {
    const pool = getPool();
    // Create a show with episodes but no watched history
    const [show] = await pool.query<any>(
      `INSERT INTO tv_shows (tmdb_id, title, year, overview, poster_path, genres)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [8888, 'Unwatched Show', 2024, 'Never watched', '/poster.jpg', '["Drama"]'],
    );
    const showId = show.insertId;

    const [season] = await pool.query<any>(
      `INSERT INTO seasons (show_id, season_number, episode_count) VALUES (?, 1, 2)`,
      [showId],
    );
    const seasonId = season.insertId;

    await pool.query<any>(
      `INSERT INTO episodes (show_id, season_id, episode_number, title, air_date)
       VALUES (?, ?, 1, 'Pilot', CURDATE())`, [showId, seasonId],
    );
    await pool.query<any>(
      `INSERT INTO episodes (show_id, season_id, episode_number, title, air_date)
       VALUES (?, ?, 2, 'Episode 2', DATE_ADD(CURDATE(), INTERVAL 1 DAY))`, [showId, seasonId],
    );

    // Add to watchlist but don't watch any episodes
    await pool.query(
      `INSERT INTO watchlist (user_id, media_type, media_id) VALUES (1, 'show', ?)`, [showId],
    );

    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/dashboard/up-next')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/dashboard/schedule', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/dashboard/schedule');
    expect(res.status).toBe(401);
  });

  it('returns episodes airing in next 7 days for tracked shows', async () => {
    await seedShowData();
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/dashboard/schedule')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toMatchObject({ showTitle: 'Test Show', showTmdbId: 9999 });
  });

  it('respects ?range= param', async () => {
    await seedShowData();
    const token = await getToken();
    // range=1 should return only today's episode
    const res = await supertest(app.server)
      .get('/api/dashboard/schedule?range=1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe('GET /api/dashboard/recent', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/dashboard/recent');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no watch history', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/dashboard/recent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns recently watched items with media details', async () => {
    const pool = getPool();
    // Watch movie id=1 from seed (tmdb_id=90001)
    await pool.query(
      `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source)
       VALUES (1, 'movie', 1, NOW(), 100, 'manual')`,
    );
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/dashboard/recent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ mediaType: 'movie', tmdbId: 90001, title: 'Test Movie Alpha' });
  });
});

describe('GET /api/dashboard/stats', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  it('returns empty array with no history in last 30 days', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.daily).toEqual([]);
    expect(res.body.summary.plays).toBe(0);
    expect(res.body.genres).toEqual([]);
  });

  it('returns daily hours for recent watch history', async () => {
    const pool = getPool();
    await pool.query(
      `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source)
       VALUES (1, 'movie', 1, NOW(), 100, 'manual')`,
    );
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.daily).toHaveLength(1);
    expect(res.body.daily[0]).toHaveProperty('date');
    expect(res.body.daily[0].hours).toBeGreaterThan(0);
    expect(res.body.summary.plays).toBe(1);
  });
});
