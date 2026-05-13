import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb, getPool } from '../../test/helpers';

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

// Seed episodes 1, 2, 3 watched (Show Alpha S1 complete) but S2 episodes 4-6 not watched.
// Show Alpha has 6 total aired episodes across 2 seasons → show is in progress.
async function seedInProgress() {
  const pool = getPool();
  await pool.query(
    `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source, completion_progress) VALUES
     (1, 'episode', 1, DATE_SUB(NOW(), INTERVAL 15 DAY), 100, 'manual', 100),
     (1, 'episode', 2, DATE_SUB(NOW(), INTERVAL 10 DAY), 100, 'manual', 100),
     (1, 'episode', 3, DATE_SUB(NOW(), INTERVAL 5 DAY),  100, 'manual', 100)`,
  );
}

describe('GET /api/progress', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/progress');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no watched shows', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/progress')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns in-progress show with correct counts and nextEpisode', async () => {
    await seedInProgress();
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/progress')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const item = res.body[0];
    expect(item).toMatchObject({
      tmdbId: 91001,
      title: 'Test Show Alpha',
      watchedEpisodes: 3,
      totalEpisodes: 6,
      totalSeasons: 2,
    });
    expect(item.nextEpisode).toMatchObject({ seasonNumber: 2, episodeNumber: 1 });
  });

  it('filters by status=ended', async () => {
    await seedInProgress();
    const token = await getToken();
    // Show Alpha has status='Ended' in seed
    const res = await supertest(app.server)
      .get('/api/progress?status=ended')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Test Show Alpha');
  });

  it('filters by status=airing returns empty (no airing shows in progress)', async () => {
    await seedInProgress();
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/progress?status=airing')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns 400 for invalid status', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/progress?status=unknown')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('excludes shows in the dropped list', async () => {
    await seedInProgress();
    const pool = getPool();
    // Add Show Alpha to dropped list
    await pool.query(
      `INSERT INTO list_items (list_id, media_type, media_id, added_at)
       SELECT id, 'show', 1, NOW() FROM lists WHERE user_id = 1 AND list_type = 'dropped'`,
    );
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/progress')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});
