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

async function getToken(): Promise<string> {
  const res = await supertest(app.server)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'correct_password' });
  return res.body.accessToken as string;
}

describe('GET /api/settings/export-token', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/settings/export-token');
    expect(res.status).toBe(401);
  });

  it('returns null token when none has been generated', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/settings/export-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeNull();
  });

  it('returns the token after one has been generated', async () => {
    const token = await getToken();

    await supertest(app.server)
      .post('/api/settings/export-token/rotate')
      .set('Authorization', `Bearer ${token}`);

    const res = await supertest(app.server)
      .get('/api/settings/export-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });
});

describe('POST /api/settings/export-token/rotate', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).post('/api/settings/export-token/rotate');
    expect(res.status).toBe(401);
  });

  it('generates and returns a new token', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .post('/api/settings/export-token/rotate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token).toHaveLength(64); // 32 random bytes = 64 hex chars
  });

  it('generates a different token on each rotation', async () => {
    const token = await getToken();

    const res1 = await supertest(app.server)
      .post('/api/settings/export-token/rotate')
      .set('Authorization', `Bearer ${token}`);

    const res2 = await supertest(app.server)
      .post('/api/settings/export-token/rotate')
      .set('Authorization', `Bearer ${token}`);

    expect(res1.body.token).not.toBe(res2.body.token);
  });

  it('GET reflects the latest rotated token', async () => {
    const token = await getToken();

    const rotateRes = await supertest(app.server)
      .post('/api/settings/export-token/rotate')
      .set('Authorization', `Bearer ${token}`);

    const getRes = await supertest(app.server)
      .get('/api/settings/export-token')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.token).toBe(rotateRes.body.token);
  });
});
