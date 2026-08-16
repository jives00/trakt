import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb } from '../../test/helpers';

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

beforeEach(async () => {
  await resetDb();
  vi.unstubAllGlobals();
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

describe('GET /api/settings/api-key', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/settings/api-key');
    expect(res.status).toBe(401);
  });

  it('returns the scrobble API key when configured', async () => {
    process.env.SCROBBLE_API_KEY = 'test-scrobble-key';
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/settings/api-key')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.scrobbleApiKey).toBe('test-scrobble-key');
  });

  it('returns 500 when SCROBBLE_API_KEY is not set', async () => {
    const saved = process.env.SCROBBLE_API_KEY;
    delete process.env.SCROBBLE_API_KEY;

    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/settings/api-key')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    process.env.SCROBBLE_API_KEY = saved;
  });
});
