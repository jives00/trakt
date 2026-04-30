import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb, getPool } from '../../test/helpers';

const app = buildApp();

beforeAll(async () => { await app.ready(); });
beforeEach(async () => {
  await resetDb();
  await getPool().query(
    `INSERT INTO collection (user_id, media_type, media_id, added_at) VALUES
     (1, 'movie', 1, DATE_SUB(NOW(), INTERVAL 20 DAY)),
     (1, 'movie', 2, DATE_SUB(NOW(), INTERVAL 10 DAY)),
     (1, 'show',  1, DATE_SUB(NOW(), INTERVAL 5 DAY))`,
  );
});
afterAll(async () => { await app.close(); await closePool(); });

async function getToken(): Promise<string> {
  const res = await supertest(app.server)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'correct_password' });
  return res.body.accessToken as string;
}

describe('GET /api/collection', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/collection');
    expect(res.status).toBe(401);
  });

  it('returns all collection items with media details', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/collection')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    // most recent first
    expect(res.body[0]).toMatchObject({ mediaType: 'show', title: 'Test Show Alpha', tmdbId: 91001 });
  });

  it('filters to movies only', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/collection?type=movie')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((i: any) => i.mediaType === 'movie')).toBe(true);
  });

  it('filters to shows only', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/collection?type=show')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].mediaType).toBe('show');
  });

  it('returns 400 for invalid type', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/collection?type=episode')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
