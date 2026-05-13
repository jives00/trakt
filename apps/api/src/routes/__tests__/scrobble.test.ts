import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb, getPool } from '../../test/helpers';
import { EmbyWebhookPayload } from '@trakt/types';

const app = buildApp();
const SCROBBLE_API_KEY = process.env.SCROBBLE_API_KEY || 'test-api-key';

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

describe('POST /api/scrobble/emby', () => {
  describe('Auth', () => {
    it('returns 401 without X-Api-Key header', async () => {
      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .send({ Event: 'PlaybackStopped' });

      expect(res.status).toBe(401);
    });

    it('returns 401 with wrong X-Api-Key', async () => {
      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', 'wrong-key')
        .send({ Event: 'PlaybackStopped' });

      expect(res.status).toBe(401);
    });

    it('accepts valid X-Api-Key', async () => {
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 72000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 64800000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      expect(res.status).toBe(200);
    });
  });

  describe('Movie scrobbling', () => {
    it('creates watch_history row for PlaybackStopped movie with 90% progress', async () => {
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 72000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 64800000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});

      const pool = getPool();
      const [movies] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = 550');
      expect(movies.length).toBe(1);
      const movieId = movies[0].id;

      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ? AND media_type = "movie"', [movieId]);
      expect((rows as any[]).length).toBe(1);

      const row = (rows as any[])[0];
      expect(row.progress_pct).toBe(90);
      expect(row.source).toBe('emby');
      expect(row.completion_progress).toBe(90);
      expect(row.playback_stopped_at).not.toBeNull();
    });

    it('ignores movie below 80% threshold', async () => {
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 75000000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      expect(res.status).toBe(200);

      const pool = getPool();
      const [movies] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = 550');
      const movieId = movies.length > 0 ? movies[0].id : null;
      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ? AND media_type = "movie"', [movieId]);
      expect((rows as any[]).length).toBe(0);
    });

    it('creates row for movie at exactly 90% threshold', async () => {
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 90000000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      expect(res.status).toBe(200);

      const pool = getPool();
      const [movies] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = 550');
      expect(movies.length).toBe(1);
      const movieId = movies[0].id;

      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ? AND media_type = "movie"', [movieId]);
      expect((rows as any[]).length).toBe(1);
    });

    it('ignores movie without TMDB ID', async () => {
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Movie',
          ProviderIds: {},
          RunTimeTicks: 72000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 64800000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      expect(res.status).toBe(200);

      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM watch_history');
      expect((rows as any[]).length).toBe(0);
    });

    it('silently drops excluded TMDB ID', async () => {
      const pool = getPool();
      await pool.query(
        'INSERT INTO scrobble_exclusions (integration, tmdb_id, media_type, title) VALUES (?, ?, ?, ?)',
        ['emby', 550, 'movie', 'Fight Club']
      );

      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 72000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 64800000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      expect(res.status).toBe(200);

      const [movies] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = 550');
      const movieId = movies.length > 0 ? movies[0].id : null;
      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ?', [movieId]);
      expect((rows as any[]).length).toBe(0);
    });
  });

  describe('Episode scrobbling', () => {
    it('creates watch_history row for PlaybackStopped episode with 90% progress', async () => {
      const episodePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Episode',
          SeriesProviderIds: { Tmdb: '1399' },
          IndexNumber: 1,
          ParentIndexNumber: 1,
          RunTimeTicks: 36000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 32400000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(episodePayload);

      expect(res.status).toBe(200);

      const pool = getPool();
      const [shows] = await pool.query<any[]>('SELECT id FROM tv_shows WHERE tmdb_id = 1399');
      expect(shows.length).toBe(1);
      const showId = shows[0].id;

      const [seasons] = await pool.query<any[]>('SELECT id FROM seasons WHERE show_id = ? AND season_number = 1', [showId]);
      expect(seasons.length).toBe(1);
      const seasonId = seasons[0].id;

      const [episodes] = await pool.query<any[]>('SELECT id FROM episodes WHERE season_id = ? AND episode_number = 1', [seasonId]);
      expect(episodes.length).toBe(1);
      const episodeId = episodes[0].id;

      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ? AND media_type = "episode"', [episodeId]);
      expect((rows as any[]).length).toBe(1);

      const row = (rows as any[])[0];
      expect(row.progress_pct).toBe(90);
      expect(row.source).toBe('emby');
    });

    it('ignores episode below 70% threshold', async () => {
      const episodePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Episode',
          SeriesProviderIds: { Tmdb: '1399' },
          IndexNumber: 1,
          ParentIndexNumber: 1,
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 65000000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(episodePayload);

      expect(res.status).toBe(200);

      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_type = "episode"');
      expect((rows as any[]).length).toBe(0);
    });

    it('creates row for episode at exactly 90% threshold', async () => {
      const episodePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Episode',
          SeriesProviderIds: { Tmdb: '1399' },
          IndexNumber: 1,
          ParentIndexNumber: 1,
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 90000000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(episodePayload);

      expect(res.status).toBe(200);

      const pool = getPool();
      const [shows] = await pool.query<any[]>('SELECT id FROM tv_shows WHERE tmdb_id = 1399');
      expect(shows.length).toBe(1);
      const showId = shows[0].id;

      const [seasons] = await pool.query<any[]>('SELECT id FROM seasons WHERE show_id = ? AND season_number = 1', [showId]);
      expect(seasons.length).toBe(1);
      const seasonId = seasons[0].id;

      const [episodes] = await pool.query<any[]>('SELECT id FROM episodes WHERE season_id = ? AND episode_number = 1', [seasonId]);
      expect(episodes.length).toBe(1);
      const episodeId = episodes[0].id;

      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ?', [episodeId]);
      expect((rows as any[]).length).toBe(1);
    });

    it('ignores episode without show TMDB ID', async () => {
      const episodePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Episode',
          SeriesProviderIds: {},
          IndexNumber: 1,
          ParentIndexNumber: 1,
          RunTimeTicks: 36000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 32400000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(episodePayload);

      expect(res.status).toBe(200);

      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM watch_history');
      expect((rows as any[]).length).toBe(0);
    });

    it('silently drops excluded show TMDB ID', async () => {
      const pool = getPool();
      await pool.query(
        'INSERT INTO scrobble_exclusions (integration, tmdb_id, media_type, title) VALUES (?, ?, ?, ?)',
        ['emby', 1399, 'show', 'Breaking Bad']
      );

      const episodePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Episode',
          SeriesProviderIds: { Tmdb: '1399' },
          IndexNumber: 1,
          ParentIndexNumber: 1,
          RunTimeTicks: 36000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 32400000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(episodePayload);

      expect(res.status).toBe(200);

      const [shows] = await pool.query<any[]>('SELECT id FROM tv_shows WHERE tmdb_id = 1399');
      const showId = shows.length > 0 ? shows[0].id : null;
      if (showId) {
        const [seasons] = await pool.query<any[]>('SELECT id FROM seasons WHERE show_id = ? AND season_number = 1', [showId]);
        if (seasons.length > 0) {
          const [episodes] = await pool.query<any[]>('SELECT id FROM episodes WHERE season_id = ? AND episode_number = 1', [seasons[0].id]);
          if (episodes.length > 0) {
            const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ?', [episodes[0].id]);
            expect((rows as any[]).length).toBe(0);
          }
        }
      }
    });
  });

  describe('Completion tracking', () => {
    it('sets completion_progress on PlaybackProgress but not playback_stopped_at', async () => {
      const pool = getPool();
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackProgress',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 90000000000, // 90%
        },
      };

      await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      const [movies] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = 550');
      const movieId = movies[0].id;
      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ?', [movieId]);

      const row = (rows as any[])[0];
      expect(row.progress_pct).toBe(90);
      expect(row.completion_progress).toBe(90);
      expect(row.playback_stopped_at).toBeNull();
    });

    it('sets playback_stopped_at on PlaybackStopped', async () => {
      const pool = getPool();
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 90000000000, // 90%
        },
      };

      await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      const [movies] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = 550');
      const movieId = movies[0].id;
      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ?', [movieId]);

      const row = (rows as any[])[0];
      expect(row.progress_pct).toBe(90);
      expect(row.completion_progress).toBe(90);
      expect(row.playback_stopped_at).not.toBeNull();
    });

    it('caps completion_progress at 100', async () => {
      const pool = getPool();
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 100000000000, // 100%
        },
      };

      await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      const [movies] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = 550');
      const movieId = movies[0].id;
      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ?', [movieId]);

      const row = (rows as any[])[0];
      expect(row.completion_progress).toBe(100);
    });
  });

  describe('Same-day dedup (upsert)', () => {
    it('updates existing row on PlaybackProgress for same-day session', async () => {
      const pool = getPool();
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 90000000000, // 90%
        },
      };

      await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      const [movies] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = 550');
      expect(movies.length).toBe(1);
      const movieId = movies[0].id;

      const [rows1] = await pool.query('SELECT * FROM watch_history WHERE media_id = ?', [movieId]);
      expect((rows1 as any[]).length).toBe(1);
      expect((rows1 as any[])[0].progress_pct).toBe(90);

      // Now send PlaybackProgress with higher progress
      const moviePayload2: EmbyWebhookPayload = {
        Event: 'PlaybackProgress',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 95000000000, // 95%
        },
      };

      await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload2);

      const [rows2] = await pool.query('SELECT * FROM watch_history WHERE media_id = ?', [movieId]);
      expect((rows2 as any[]).length).toBe(1);
      expect((rows2 as any[])[0].progress_pct).toBe(95);
    });

    it('does not create duplicate rows on multiple PlaybackProgress events same day', async () => {
      const pool = getPool();
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackProgress',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 90000000000, // 90%
        },
      };

      await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      const [movies] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = 550');
      const movieId = movies.length > 0 ? movies[0].id : null;
      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ?', [movieId]);
      expect((rows as any[]).length).toBe(1);
    });
  });

  describe('Non-handled events', () => {
    it('returns 200 {} for unhandled event types', async () => {
      const payload: any = {
        Event: 'PlaybackStart',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 72000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 0,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});

      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM watch_history');
      expect((rows as any[]).length).toBe(0);
    });

    it('returns 200 {} for missing Event field', async () => {
      const payload: EmbyWebhookPayload = {
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 72000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 64800000000,
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    it('returns 400 for malformed payload', async () => {
      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send({ Event: 'PlaybackStopped' });

      expect(res.status).toBe(400);
    });
  });

  describe('Progress calculation', () => {
    it('correctly calculates progress for fractional values', async () => {
      const pool = getPool();
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 90000000000, // 90%
        },
      };

      const res = await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      expect(res.status).toBe(200);

      const [movies] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = 550');
      const movieId = movies.length > 0 ? movies[0].id : null;
      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ?', [movieId]);
      expect((rows as any[])[0].progress_pct).toBe(90);
    });

    it('rounds progress to nearest integer', async () => {
      const pool = getPool();
      const moviePayload: EmbyWebhookPayload = {
        Event: 'PlaybackStopped',
        Item: {
          Type: 'Movie',
          ProviderIds: { Tmdb: '550' },
          RunTimeTicks: 100000000000,
        },
        PlaybackInfo: {
          PlaybackPositionTicks: 92333333333, // 92.333...% → rounds to 92%
        },
      };

      await supertest(app.server)
        .post('/api/scrobble/emby')
        .set('X-Api-Key', SCROBBLE_API_KEY)
        .send(moviePayload);

      const [movies] = await pool.query<any[]>('SELECT id FROM movies WHERE tmdb_id = 550');
      const movieId = movies.length > 0 ? movies[0].id : null;
      const [rows] = await pool.query('SELECT * FROM watch_history WHERE media_id = ?', [movieId]);
      expect((rows as any[])[0].progress_pct).toBe(92);
    });
  });
});
