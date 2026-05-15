import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb, getPool } from '../../test/helpers';

const app = buildApp();

beforeAll(async () => { await app.ready(); });
beforeEach(async () => {
  await resetDb();
  // Insert watch history referencing seed movies (id=1,2) and episodes (id=1,2,3)
  await getPool().query(
    `INSERT INTO watch_history (id, user_id, media_type, media_id, watched_at, progress_pct, source, completion_progress) VALUES
     (1, 1, 'movie',   1, DATE_SUB(NOW(), INTERVAL 5 DAY), 100, 'manual', 100),
     (2, 1, 'episode', 1, DATE_SUB(NOW(), INTERVAL 4 DAY), 100, 'emby', 100),
     (3, 1, 'episode', 2, DATE_SUB(NOW(), INTERVAL 3 DAY),  90, 'kodi', 90),
     (4, 1, 'movie',   2, DATE_SUB(NOW(), INTERVAL 1 DAY), 100, 'manual', 100)`,
  );
});
afterAll(async () => { await app.close(); await closePool(); });

async function getToken(): Promise<string> {
  const res = await supertest(app.server)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'correct_password' });
  return res.body.accessToken as string;
}

describe('GET /api/history', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/history');
    expect(res.status).toBe(401);
  });

  it('returns paginated history with media details', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items).toHaveLength(4);
    // most recent first
    const first = res.body.items[0];
    expect(first).toMatchObject({ mediaType: 'movie', tmdbId: 90002, title: 'Test Movie Beta' });
  });

  it('filters to movies only', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/history?type=movie')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.every((i: any) => i.mediaType === 'movie')).toBe(true);
  });

  it('filters to episodes only with show title and season/episode numbers', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/history?type=episode')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const item = res.body.items[0];
    expect(item.mediaType).toBe('episode');
    expect(item.showTitle).toBe('Test Show Alpha');
    expect(item.seasonNumber).toBe(1);
    expect(item.episodeNumber).toBeGreaterThanOrEqual(1);
  });

  it('returns 400 for invalid type', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/history?type=show')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid date format', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/history?date=invalid')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/history/:id', () => {
  it('deletes an entry and reduces count', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .delete('/api/history/1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const listRes = await supertest(app.server)
      .get('/api/history')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.total).toBe(3);
  });

  it('returns 404 for non-existent entry', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .delete('/api/history/9999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
