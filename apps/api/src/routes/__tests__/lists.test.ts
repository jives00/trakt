import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb } from '../../test/helpers';

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

describe('GET /api/lists', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/lists');
    expect(res.status).toBe(401);
  });

  it('returns only system lists initially', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/lists')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.every((l: any) => l.isSystem)).toBe(true);
  });
});

describe('POST /api/lists', () => {
  it('creates a list', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Favorites', description: 'Top picks' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'My Favorites', description: 'Top picks', itemCount: 0 });
    expect(res.body.id).toBeGreaterThan(0);
  });

  it('returns 400 with missing name', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'No name' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/lists/:id', () => {
  it('returns list with items', async () => {
    const token = await getToken();
    const { body: list } = await supertest(app.server)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test List' });

    // Add movie (id=1) from seed
    await supertest(app.server)
      .post(`/api/lists/${list.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mediaType: 'movie', mediaId: 1 });

    const res = await supertest(app.server)
      .get(`/api/lists/${list.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ mediaType: 'movie', tmdbId: 90001, title: 'Test Movie Alpha' });
    expect(res.body.itemCount).toBe(1);
  });

  it('returns 404 for unknown list', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/lists/9999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/lists/:id/items/:mediaType/:mediaId', () => {
  it('removes an item from a list', async () => {
    const token = await getToken();
    const { body: list } = await supertest(app.server)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test' });

    await supertest(app.server)
      .post(`/api/lists/${list.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mediaType: 'movie', mediaId: 1 });

    const removeRes = await supertest(app.server)
      .delete(`/api/lists/${list.id}/items/movie/1`)
      .set('Authorization', `Bearer ${token}`);
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.removed).toBe(true);

    const detailRes = await supertest(app.server)
      .get(`/api/lists/${list.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detailRes.body.items).toHaveLength(0);
  });
});

describe('DELETE /api/lists/:id', () => {
  it('deletes a list', async () => {
    const token = await getToken();
    const { body: list } = await supertest(app.server)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Temp' });

    const res = await supertest(app.server)
      .delete(`/api/lists/${list.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const listsRes = await supertest(app.server)
      .get('/api/lists')
      .set('Authorization', `Bearer ${token}`);
    // Only the 3 system lists remain after deleting the custom list
    expect(listsRes.body).toHaveLength(3);
    expect(listsRes.body.every((l: any) => l.isSystem)).toBe(true);
  });
});
