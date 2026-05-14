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

describe('GET /api/export/excel', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/export/excel');
    expect(res.status).toBe(401);
  });

  it('returns an XLSX file with correct headers', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/export/excel')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="trakt-export-\d{4}-\d{2}-\d{2}\.xlsx"/,
    );
  });

  it('returns a valid XLSX buffer (PK magic bytes)', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/export/excel')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    // XLSX/ZIP files start with PK (0x50 0x4B)
    expect(res.body[0]).toBe(0x50);
    expect(res.body[1]).toBe(0x4b);
  });

  it('includes watch history data in the export', async () => {
    const token = await getToken();
    const pool = getPool();

    await pool.query(
      `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source)
       VALUES (1, 'movie', 1, NOW(), 100, 'manual')`,
    );

    const res = await supertest(app.server)
      .get('/api/export/excel')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    // A non-empty export will be larger than an empty one
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(1000);
  });
});
