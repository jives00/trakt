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

async function setupExportToken(): Promise<string> {
  const token = await getToken();
  const res = await supertest(app.server)
    .post('/api/settings/export-token/rotate')
    .set('Authorization', `Bearer ${token}`);
  return res.body.token as string;
}

async function createCatalogList(name = 'My Movies', slug = 'my-movies'): Promise<number> {
  const pool = getPool();
  const [result] = await pool.query<any>(
    `INSERT INTO lists (user_id, name, list_type, is_system, slug, stremio_catalog, created_at)
     VALUES (1, ?, 'custom', FALSE, ?, TRUE, NOW())`,
    [name, slug],
  );
  return (result as any).insertId as number;
}

async function addMovieToList(listId: number): Promise<void> {
  const pool = getPool();
  // Use seed movie id=1 (tmdb_id=90001, 'Test Movie Alpha')
  await pool.query(
    `INSERT INTO list_items (list_id, media_type, media_id, added_at) VALUES (?, 'movie', 1, NOW())`,
    [listId],
  );
}

async function addShowToList(listId: number): Promise<void> {
  const pool = getPool();
  // Use seed show id=1 (tmdb_id=91001, 'Test Show Alpha')
  await pool.query(
    `INSERT INTO list_items (list_id, media_type, media_id, added_at) VALUES (?, 'show', 1, NOW())`,
    [listId],
  );
}

// ─── RSS ──────────────────────────────────────────────────────────────────────

describe('GET /api/export/lists/:slugOrId/rss', () => {
  it('returns 401 when token is missing', async () => {
    const res = await supertest(app.server).get('/api/export/lists/my-movies/rss');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await supertest(app.server).get('/api/export/lists/my-movies/rss?token=badtoken');
    expect(res.status).toBe(401);
  });

  it('returns 404 when list does not exist', async () => {
    const exportToken = await setupExportToken();
    const res = await supertest(app.server).get(
      `/api/export/lists/nonexistent/rss?token=${exportToken}`,
    );
    expect(res.status).toBe(404);
  });

  it('returns valid RSS XML for a list with items', async () => {
    const exportToken = await setupExportToken();
    const listId = await createCatalogList();
    await addMovieToList(listId);

    const res = await supertest(app.server).get(
      `/api/export/lists/my-movies/rss?token=${exportToken}`,
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/rss+xml');
    expect(res.text).toContain('<?xml version="1.0"');
    expect(res.text).toContain('<rss version="2.0">');
    expect(res.text).toContain('Test Movie Alpha');
  });

  it('can fetch list by numeric id', async () => {
    const exportToken = await setupExportToken();
    const listId = await createCatalogList();
    await addMovieToList(listId);

    const res = await supertest(app.server).get(
      `/api/export/lists/${listId}/rss?token=${exportToken}`,
    );

    expect(res.status).toBe(200);
    expect(res.text).toContain('Test Movie Alpha');
  });

  it('uses tmdb:// guid when no imdb id is present', async () => {
    const exportToken = await setupExportToken();
    const listId = await createCatalogList();
    await addMovieToList(listId);

    const res = await supertest(app.server).get(
      `/api/export/lists/my-movies/rss?token=${exportToken}`,
    );

    expect(res.text).toContain('tmdb://90001');
  });

  it('uses imdb:// guid when imdb id is present', async () => {
    const pool = getPool();
    const exportToken = await setupExportToken();
    const listId = await createCatalogList();
    await addMovieToList(listId);
    await pool.query(
      `INSERT INTO external_ids (media_type, media_id, source, external_id) VALUES ('movie', 1, 'imdb', 'tt9000100')`,
    );

    const res = await supertest(app.server).get(
      `/api/export/lists/my-movies/rss?token=${exportToken}`,
    );

    expect(res.text).toContain('imdb://tt9000100');
  });

  it('filters by mediaType=movie', async () => {
    const exportToken = await setupExportToken();
    const listId = await createCatalogList('Mixed', 'mixed');
    await addMovieToList(listId);
    await addShowToList(listId);

    const res = await supertest(app.server).get(
      `/api/export/lists/mixed/rss?token=${exportToken}&mediaType=movie`,
    );

    expect(res.status).toBe(200);
    expect(res.text).toContain('Test Movie Alpha');
    expect(res.text).not.toContain('Test Show Alpha');
  });

  it('filters by mediaType=show', async () => {
    const exportToken = await setupExportToken();
    const listId = await createCatalogList('Mixed', 'mixed');
    await addMovieToList(listId);
    await addShowToList(listId);

    const res = await supertest(app.server).get(
      `/api/export/lists/mixed/rss?token=${exportToken}&mediaType=show`,
    );

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Test Movie Alpha');
    expect(res.text).toContain('Test Show Alpha');
  });
});

// ─── StevenLu ─────────────────────────────────────────────────────────────────

describe('GET /api/export/lists/:slugOrId/stevenlu', () => {
  it('returns 401 when token is missing', async () => {
    const res = await supertest(app.server).get('/api/export/lists/my-movies/stevenlu');
    expect(res.status).toBe(401);
  });

  it('returns 404 when list does not exist', async () => {
    const exportToken = await setupExportToken();
    const res = await supertest(app.server).get(
      `/api/export/lists/nonexistent/stevenlu?token=${exportToken}`,
    );
    expect(res.status).toBe(404);
  });

  it('returns JSON array of movies with title', async () => {
    const exportToken = await setupExportToken();
    const listId = await createCatalogList();
    await addMovieToList(listId);

    const res = await supertest(app.server).get(
      `/api/export/lists/my-movies/stevenlu?token=${exportToken}`,
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ title: 'Test Movie Alpha' });
  });

  it('excludes shows from the output', async () => {
    const exportToken = await setupExportToken();
    const listId = await createCatalogList('Mixed', 'mixed');
    await addMovieToList(listId);
    await addShowToList(listId);

    const res = await supertest(app.server).get(
      `/api/export/lists/mixed/stevenlu?token=${exportToken}`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Test Movie Alpha');
  });
});

// ─── Sonarr ───────────────────────────────────────────────────────────────────

describe('GET /api/export/lists/:slugOrId/sonarr', () => {
  it('returns 401 when token is missing', async () => {
    const res = await supertest(app.server).get('/api/export/lists/shows/sonarr');
    expect(res.status).toBe(401);
  });

  it('returns 404 when list does not exist', async () => {
    const exportToken = await setupExportToken();
    const res = await supertest(app.server).get(
      `/api/export/lists/nonexistent/sonarr?token=${exportToken}`,
    );
    expect(res.status).toBe(404);
  });

  it('returns JSON array of shows with tvdbId when present', async () => {
    const pool = getPool();
    const exportToken = await setupExportToken();
    const listId = await createCatalogList('Shows', 'shows-list');
    await addShowToList(listId);
    await pool.query(
      `INSERT INTO external_ids (media_type, media_id, source, external_id) VALUES ('show', 1, 'tvdb', '281662')`,
    );

    const res = await supertest(app.server).get(
      `/api/export/lists/shows-list/sonarr?token=${exportToken}`,
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ tvdbId: 281662, title: 'Test Show Alpha' });
  });

  it('excludes shows without a tvdbId', async () => {
    const exportToken = await setupExportToken();
    const listId = await createCatalogList('Shows', 'shows-list');
    await addShowToList(listId);
    // No tvdb external_id inserted

    const res = await supertest(app.server).get(
      `/api/export/lists/shows-list/sonarr?token=${exportToken}`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('excludes movies from the output', async () => {
    const pool = getPool();
    const exportToken = await setupExportToken();
    const listId = await createCatalogList('Mixed', 'mixed-sonarr');
    await addMovieToList(listId);
    await addShowToList(listId);
    await pool.query(
      `INSERT INTO external_ids (media_type, media_id, source, external_id) VALUES ('show', 1, 'tvdb', '281662')`,
    );

    const res = await supertest(app.server).get(
      `/api/export/lists/mixed-sonarr/sonarr?token=${exportToken}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.every((i: any) => typeof i.tvdbId === 'number')).toBe(true);
    // movies don't have tvdbId so they're excluded
    expect(res.body).toHaveLength(1);
  });
});
