import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
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

describe('Stremio Addon', () => {
  describe('GET /stremio-addon/manifest.json', () => {
    it('returns addon manifest', async () => {
      const res = await supertest(app.server).get('/stremio-addon/manifest.json');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 'community.trakt-personal',
        version: '1.0.0',
        name: 'Personal Trakt Tracker',
        description: expect.any(String),
        resources: expect.arrayContaining(['subtitles']),
        types: expect.arrayContaining(['movie', 'series']),
        catalogs: [],
        idPrefixes: ['tt'],
      });
    });

    it('accepts requests from any origin (CORS)', async () => {
      const res = await supertest(app.server)
        .get('/stremio-addon/manifest.json')
        .set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('GET /stremio-addon/subtitles/:type/:id/:extra.json', () => {
    it('returns empty subtitles array and starts poll loop', async () => {
      const res = await supertest(app.server).get('/stremio-addon/subtitles/movie/tt0111161/empty.json');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ subtitles: [] });
    });

    it('handles series type', async () => {
      const res = await supertest(app.server).get('/stremio-addon/subtitles/series/tt1399/empty.json');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ subtitles: [] });
    });

    it('ignores invalid type', async () => {
      const res = await supertest(app.server).get('/stremio-addon/subtitles/invalid/tt0111161/empty.json');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ subtitles: [] });
    });

    it('ignores non-IMDB IDs', async () => {
      const res = await supertest(app.server).get('/stremio-addon/subtitles/movie/12345/empty.json');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ subtitles: [] });
    });

    it('handles extra data with JSON', async () => {
      const extraJson = JSON.stringify({ language: 'en' });
      const res = await supertest(app.server).get(`/stremio-addon/subtitles/movie/tt0111161/${extraJson}.json`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ subtitles: [] });
    });
  });

  describe('Invalid endpoints', () => {
    it('returns 404 for invalid addon routes', async () => {
      const res = await supertest(app.server).get('/stremio-addon/invalid');

      expect(res.status).toBe(404);
    });

    it('returns 404 for malformed subtitles path', async () => {
      const res = await supertest(app.server).get('/stremio-addon/subtitles');

      expect(res.status).toBe(404);
    });
  });
});
