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

describe('GET /api/settings/trakt-auth', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/settings/trakt-auth');
    expect(res.status).toBe(401);
  });

  it('returns isConnected falsy when no token is stored', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/settings/trakt-auth')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.isConnected).toBeFalsy();
  });
});

describe('POST /api/settings/trakt-auth', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server)
      .post('/api/settings/trakt-auth')
      .send({ accessToken: 'tok', refreshToken: 'ref', expiresAt: new Date(Date.now() + 86400000).toISOString() });
    expect(res.status).toBe(401);
  });

  it('stores a trakt token and returns isConnected: true', async () => {
    const token = await getToken();
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    const res = await supertest(app.server)
      .post('/api/settings/trakt-auth')
      .set('Authorization', `Bearer ${token}`)
      .send({ accessToken: 'my-access', refreshToken: 'my-refresh', expiresAt });

    expect(res.status).toBe(201);
    expect(res.body.isConnected).toBe(true);
  });

  it('returns 400 when required fields are missing', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .post('/api/settings/trakt-auth')
      .set('Authorization', `Bearer ${token}`)
      .send({ accessToken: 'my-access' });

    expect(res.status).toBe(400);
  });

  it('stored token is reflected by GET /settings/trakt-auth', async () => {
    const token = await getToken();
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    await supertest(app.server)
      .post('/api/settings/trakt-auth')
      .set('Authorization', `Bearer ${token}`)
      .send({ accessToken: 'my-access', refreshToken: 'my-refresh', expiresAt });

    const checkRes = await supertest(app.server)
      .get('/api/settings/trakt-auth')
      .set('Authorization', `Bearer ${token}`);

    expect(checkRes.body.isConnected).toBe(true);
  });
});

describe('POST /api/settings/trakt-auth/start', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).post('/api/settings/trakt-auth/start');
    expect(res.status).toBe(401);
  });

  it('returns userCode, expiresIn, and verificationUrl on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          device_code: 'device-123',
          user_code: 'ABC123',
          verification_url: 'https://trakt.tv/activate',
          expires_in: 600,
          interval: 5,
        }),
      }),
    );

    const token = await getToken();
    const res = await supertest(app.server)
      .post('/api/settings/trakt-auth/start')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userCode).toBe('ABC123');
    expect(res.body.expiresIn).toBe(600);
    expect(res.body.verificationUrl).toBe('https://trakt.tv/activate');
  });

  it('returns 500 when Trakt API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'service unavailable' }),
      }),
    );

    const token = await getToken();
    const res = await supertest(app.server)
      .post('/api/settings/trakt-auth/start')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });
});

describe('POST /api/settings/trakt-auth/check', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).post('/api/settings/trakt-auth/check');
    expect(res.status).toBe(401);
  });

  it('returns pending status when poll returns 400', async () => {
    // First start a flow so deviceCodeCache is populated
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            device_code: 'device-123',
            user_code: 'ABC123',
            verification_url: 'https://trakt.tv/activate',
            expires_in: 600,
            interval: 5,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'pending' }),
        }),
    );

    const token = await getToken();
    await supertest(app.server)
      .post('/api/settings/trakt-auth/start')
      .set('Authorization', `Bearer ${token}`);

    const checkRes = await supertest(app.server)
      .post('/api/settings/trakt-auth/check')
      .set('Authorization', `Bearer ${token}`);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.status).toBe('pending');
  });
});
