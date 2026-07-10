import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, getPool, resetDb } from '../../test/helpers';

const app = buildApp();

async function seedCatalogList() {
  const pool = getPool();
  await pool.query(
    `INSERT INTO lists (id, user_id, name, list_type, is_system, slug, stremio_catalog, created_at)
     VALUES (10, 1, 'Nuvio', 'custom', FALSE, 'nuvio', TRUE, NOW())`,
  );
  await pool.query(
    `INSERT INTO list_items (list_id, media_type, media_id, added_at) VALUES
       (10, 'show', 1, NOW()), (10, 'show', 2, NOW())`,
  );
}

async function watchEpisodes(episodeIds: number[]) {
  if (episodeIds.length === 0) return;
  await getPool().query(
    `INSERT INTO watch_history (user_id, media_type, media_id, watched_at)
     VALUES ${episodeIds.map(() => "(1, 'episode', ?, NOW())").join(',')}`,
    episodeIds,
  );
}

async function setAirDate(episodeIds: number[], sql: string) {
  await getPool().query(
    `UPDATE episodes SET air_date = ${sql} WHERE id IN (${episodeIds.map(() => '?').join(',')})`,
    episodeIds,
  );
}

async function catalogTitles(): Promise<string[]> {
  const res = await supertest(app.server).get('/nuvio-addon/catalog/series/personal-nuvio-series.json');
  expect(res.status).toBe(200);
  return (res.body.metas as { name: string }[]).map((m) => m.name);
}

beforeAll(async () => {
  await app.ready();
});

beforeEach(async () => {
  await resetDb();
  await seedCatalogList();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

describe('Nuvio addon series catalog', () => {
  it('includes shows with no watched episodes', async () => {
    expect(await catalogTitles()).toEqual(
      expect.arrayContaining(['Test Show Alpha', 'Test Show Beta']),
    );
  });

  it('includes shows with only some episodes watched', async () => {
    await watchEpisodes([1, 2, 3, 4, 5]);
    expect(await catalogTitles()).toContain('Test Show Alpha');
  });

  it('excludes shows where every aired episode is watched', async () => {
    await watchEpisodes([1, 2, 3, 4, 5, 6]);
    expect(await catalogTitles()).not.toContain('Test Show Alpha');
  });

  it('excludes shows whose episodes have not aired yet', async () => {
    await setAirDate([7, 8], 'DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
    expect(await catalogTitles()).not.toContain('Test Show Beta');
  });

  it('excludes fully watched shows that still have unaired episodes', async () => {
    await watchEpisodes([7]);
    await setAirDate([8], 'DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
    expect(await catalogTitles()).not.toContain('Test Show Beta');
  });

  it('re-includes a fully watched show once a new episode airs', async () => {
    await watchEpisodes([7, 8]);
    expect(await catalogTitles()).not.toContain('Test Show Beta');

    await getPool().query(
      `INSERT INTO episodes (id, season_id, show_id, episode_number, title, runtime_min, air_date)
       VALUES (9, 3, 2, 3, 'Beta Ep 3', 30, CURDATE())`,
    );
    expect(await catalogTitles()).toContain('Test Show Beta');
  });
});
