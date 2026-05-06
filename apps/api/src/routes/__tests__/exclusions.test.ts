import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb, getPool } from '../../test/helpers';

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

describe('GET /api/settings/exclusions', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/settings/exclusions');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no exclusions exist', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/settings/exclusions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all exclusions when integration filter is not provided', async () => {
    const token = await getToken();
    const pool = getPool();

    await pool.query(
      `INSERT INTO scrobble_exclusions (integration, tmdb_id, media_type, title) VALUES
       (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
      ['emby', 550, 'movie', 'Fight Club', 'stremio', 1399, 'show', 'Breaking Bad', 'kodi', 90001, 'movie', 'Test Movie Alpha'],
    );

    const res = await supertest(app.server)
      .get('/api/settings/exclusions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('filters exclusions by integration', async () => {
    const token = await getToken();
    const pool = getPool();

    await pool.query(
      `INSERT INTO scrobble_exclusions (integration, tmdb_id, media_type, title) VALUES
       (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
      ['emby', 550, 'movie', 'Fight Club', 'stremio', 1399, 'show', 'Breaking Bad', 'emby', 90001, 'movie', 'Test Movie Alpha'],
    );

    const res = await supertest(app.server)
      .get('/api/settings/exclusions?integration=emby')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((e: any) => e.integration === 'emby')).toBe(true);
  });

  it('returns 400 for invalid integration filter', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/settings/exclusions?integration=invalid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /api/settings/exclusions', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server)
      .post('/api/settings/exclusions')
      .send({ integration: 'emby', tmdbId: 550, mediaType: 'movie', title: 'Fight Club' });

    expect(res.status).toBe(401);
  });

  it('creates a new exclusion', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .post('/api/settings/exclusions')
      .set('Authorization', `Bearer ${token}`)
      .send({ integration: 'emby', tmdbId: 550, mediaType: 'movie', title: 'Fight Club' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ integration: 'emby', tmdbId: 550, mediaType: 'movie', title: 'Fight Club' });
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it('returns 400 for missing required fields', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .post('/api/settings/exclusions')
      .set('Authorization', `Bearer ${token}`)
      .send({ integration: 'emby', tmdbId: 550 });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid mediaType', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .post('/api/settings/exclusions')
      .set('Authorization', `Bearer ${token}`)
      .send({ integration: 'emby', tmdbId: 550, mediaType: 'episode', title: 'Test' });

    expect(res.status).toBe(400);
  });

  it('silently succeeds on duplicate (INSERT IGNORE)', async () => {
    const token = await getToken();
    const body = { integration: 'emby', tmdbId: 550, mediaType: 'movie', title: 'Fight Club' };

    const res1 = await supertest(app.server)
      .post('/api/settings/exclusions')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(res1.status).toBe(201);

    const res2 = await supertest(app.server)
      .post('/api/settings/exclusions')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    // Should succeed but return 201 (same as first insert)
    expect(res2.status).toBe(201);

    // Verify only one row was inserted
    const list = await supertest(app.server)
      .get('/api/settings/exclusions?integration=emby')
      .set('Authorization', `Bearer ${token}`);

    expect(list.body).toHaveLength(1);
  });
});

describe('DELETE /api/settings/exclusions/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server)
      .delete('/api/settings/exclusions/1');

    expect(res.status).toBe(401);
  });

  it('deletes an exclusion', async () => {
    const token = await getToken();
    const pool = getPool();

    const [insertRes] = await pool.query<any[]>(
      `INSERT INTO scrobble_exclusions (integration, tmdb_id, media_type, title) VALUES (?, ?, ?, ?)`,
      ['emby', 550, 'movie', 'Fight Club'],
    );
    const id = (insertRes as any).insertId;

    const res = await supertest(app.server)
      .delete(`/api/settings/exclusions/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    // Verify it's gone
    const listRes = await supertest(app.server)
      .get('/api/settings/exclusions?integration=emby')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body).toHaveLength(0);
  });

  it('returns 404 when exclusion does not exist', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .delete('/api/settings/exclusions/9999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 for non-numeric id', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .delete('/api/settings/exclusions/abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});
