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

describe('GET /api/ratings', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/ratings');
    expect(res.status).toBe(401);
  });

  it('returns empty initially', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/ratings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe('POST /api/ratings', () => {
  it('creates a rating and appears in GET /api/ratings', async () => {
    const token = await getToken();
    const postRes = await supertest(app.server)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ mediaType: 'movie', mediaId: 1, rating: 8 });

    expect(postRes.status).toBe(200);
    expect(postRes.body).toMatchObject({ mediaType: 'movie', mediaId: 1, rating: 8 });

    const getRes = await supertest(app.server)
      .get('/api/ratings')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.body.total).toBe(1);
    expect(getRes.body.items[0]).toMatchObject({
      mediaType: 'movie', rating: 8, tmdbId: 90001, title: 'Test Movie Alpha',
    });
  });

  it('returns 400 for rating out of range', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ mediaType: 'movie', mediaId: 1, rating: 11 });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/ratings/:mediaType/:mediaId', () => {
  it('updates an existing rating', async () => {
    const token = await getToken();
    await supertest(app.server)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ mediaType: 'movie', mediaId: 1, rating: 7 });

    const putRes = await supertest(app.server)
      .put('/api/ratings/movie/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 9 });
    expect(putRes.status).toBe(200);
    expect(putRes.body.rating).toBe(9);

    const getRes = await supertest(app.server)
      .get('/api/ratings')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.body.items[0].rating).toBe(9);
  });
});

describe('DELETE /api/ratings/:mediaType/:mediaId', () => {
  it('removes a rating', async () => {
    const token = await getToken();
    await supertest(app.server)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ mediaType: 'movie', mediaId: 1, rating: 8 });

    const delRes = await supertest(app.server)
      .delete('/api/ratings/movie/1')
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.deleted).toBe(true);

    const getRes = await supertest(app.server)
      .get('/api/ratings')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.body.total).toBe(0);
  });

  it('returns 404 for non-existent rating', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .delete('/api/ratings/movie/1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/ratings?sort=rating', () => {
  it('sorts by rating descending', async () => {
    const token = await getToken();
    await supertest(app.server).post('/api/ratings').set('Authorization', `Bearer ${token}`)
      .send({ mediaType: 'movie', mediaId: 1, rating: 6 });
    await supertest(app.server).post('/api/ratings').set('Authorization', `Bearer ${token}`)
      .send({ mediaType: 'movie', mediaId: 2, rating: 9 });

    const res = await supertest(app.server)
      .get('/api/ratings?sort=rating')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items[0].rating).toBe(9);
    expect(res.body.items[1].rating).toBe(6);
  });
});
