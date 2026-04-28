import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb } from '../../test/helpers';

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

describe('POST /api/auth/login', () => {
  it('returns an access token on valid credentials', async () => {
    const res = await supertest(app.server)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'correct_password' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.headers['set-cookie']).toBeDefined(); // refresh token cookie
  });

  it('returns 401 on wrong password', async () => {
    const res = await supertest(app.server)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('accessToken');
  });

  it('returns 401 on unknown username', async () => {
    const res = await supertest(app.server)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'anything' });

    expect(res.status).toBe(401);
  });

  it('returns 400 on missing fields', async () => {
    const res = await supertest(app.server)
      .post('/api/auth/login')
      .send({ username: 'testuser' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues a new access token when a valid refresh cookie is present', async () => {
    // Log in first to get the refresh cookie
    const loginRes = await supertest(app.server)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'correct_password' });

    const cookies = loginRes.headers['set-cookie'] as string[];

    const res = await supertest(app.server)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('returns 401 when no refresh cookie is present', async () => {
    const res = await supertest(app.server).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the refresh cookie and returns 204', async () => {
    const loginRes = await supertest(app.server)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'correct_password' });

    const cookies = loginRes.headers['set-cookie'] as string[];

    const logoutRes = await supertest(app.server)
      .post('/api/auth/logout')
      .set('Cookie', cookies);

    expect(logoutRes.status).toBe(204);

    // Refresh token is now invalid
    const refreshRes = await supertest(app.server)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);

    expect(refreshRes.status).toBe(401);
  });
});

describe('Protected route rejection', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await supertest(app.server).get('/api/history');
    expect(res.status).toBe(401);
  });

  it('returns 401 when the access token is expired or malformed', async () => {
    const res = await supertest(app.server)
      .get('/api/history')
      .set('Authorization', 'Bearer not.a.real.token');

    expect(res.status).toBe(401);
  });
});
