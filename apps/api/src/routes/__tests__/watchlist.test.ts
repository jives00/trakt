import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb, getPool } from '../../test/helpers';

const app = buildApp();

beforeAll(async () => { await app.ready(); });
beforeEach(async () => {
  await resetDb();
  await getPool().query(
    `INSERT INTO watchlist (user_id, media_type, media_id, added_at) VALUES
     (1, 'show',  1, DATE_SUB(NOW(), INTERVAL 10 DAY)),
     (1, 'movie', 1, DATE_SUB(NOW(), INTERVAL 5 DAY))`,
  );
});
afterAll(async () => { await app.close(); await closePool(); });

async function getToken(): Promise<string> {
  const res = await supertest(app.server)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'correct_password' });
  return res.body.accessToken as string;
}

describe('GET /api/watchlist', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/watchlist');
    expect(res.status).toBe(401);
  });

  it('returns all watchlist items with media details', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/watchlist')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // most recent first
    expect(res.body[0]).toMatchObject({ mediaType: 'movie', title: 'Test Movie Alpha', tmdbId: 90001 });
  });

  it('filters to shows only', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/watchlist?type=show')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].mediaType).toBe('show');
    expect(res.body[0].tmdbId).toBe(91001);
  });

  it('returns 400 for invalid type', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/watchlist?type=episode')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
