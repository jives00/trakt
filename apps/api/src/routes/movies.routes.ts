import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RowDataPacket } from 'mysql2/promise';
import { authenticate } from '../middleware/auth';
import { getOrFetchMovie, getOrFetchMovieCast, getOrFetchMovieCrew, forceRefreshMovieMetadata, forceRefreshMovieCast } from '../services/movies.service';
import {
  getMovieStatus, toggleWatchlist, toggleCollection, removeFromWatchlist, removeFromCollection,
  markMovieWatched, unmarkMovieWatched,
} from '../services/user-media.service';
import { getAvailableImages, setImageOverride } from '../services/image-overrides.service';
import { getPool } from '../db';
import { HistoryItem } from '@trakt/types';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

function params(request: FastifyRequest) {
  return request.params as Record<string, string>;
}

export async function moviesRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/movies/:tmdbId', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number((request.params as any).tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return reply.status(400).send({ error: 'Invalid tmdbId' });
    const movie = await getOrFetchMovie(tmdbId);
    const status = await getMovieStatus(userId(request), movie.id);
    return { movie, status };
  });

  app.post('/movies/:tmdbId/watched', auth, async (request: FastifyRequest) => {
    const tmdbId = Number((request.params as any).tmdbId);
    const { watchedAt } = (request.body as any) ?? {};
    const movie = await getOrFetchMovie(tmdbId);
    await markMovieWatched(userId(request), movie.id, watchedAt);
    return { watched: true };
  });

  app.delete('/movies/:tmdbId/watched', auth, async (request: FastifyRequest) => {
    const tmdbId = Number((request.params as any).tmdbId);
    const movie = await getOrFetchMovie(tmdbId);
    await unmarkMovieWatched(userId(request), movie.id);
    return { watched: false };
  });

  app.get('/movies/:tmdbId/history', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number((request.params as any).tmdbId);
    const movie = await getOrFetchMovie(tmdbId);
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         CAST(wh.id AS UNSIGNED) AS id, wh.media_type AS mediaType, wh.media_id AS mediaId,
         wh.watched_at AS watchedAt, wh.progress_pct AS progressPct, wh.source,
         m.tmdb_id AS tmdbId, m.title, m.poster_path AS posterPath
       FROM watch_history wh
       LEFT JOIN movies m ON m.id=wh.media_id
       WHERE wh.user_id=? AND wh.media_type='movie' AND wh.media_id=?
       ORDER BY wh.watched_at DESC`,
      [userId(request), movie.id],
    );
    return rows as HistoryItem[];
  });

  app.post('/movies/:tmdbId/watchlist', auth, async (request: FastifyRequest) => {
    const tmdbId = Number((request.params as any).tmdbId);
    const movie = await getOrFetchMovie(tmdbId);
    const added = await toggleWatchlist(userId(request), 'movie', movie.id);
    return { inWatchlist: added };
  });

  app.delete('/movies/:tmdbId/watchlist', auth, async (request: FastifyRequest) => {
    const tmdbId = Number((request.params as any).tmdbId);
    const movie = await getOrFetchMovie(tmdbId);
    await removeFromWatchlist(userId(request), 'movie', movie.id);
    return { inWatchlist: false };
  });

  app.post('/movies/:tmdbId/collection', auth, async (request: FastifyRequest) => {
    const tmdbId = Number((request.params as any).tmdbId);
    const movie = await getOrFetchMovie(tmdbId);
    const added = await toggleCollection(userId(request), 'movie', movie.id);
    return { inCollection: added };
  });

  app.delete('/movies/:tmdbId/collection', auth, async (request: FastifyRequest) => {
    const tmdbId = Number((request.params as any).tmdbId);
    const movie = await getOrFetchMovie(tmdbId);
    await removeFromCollection(userId(request), 'movie', movie.id);
    return { inCollection: false };
  });

  app.get('/movies/:tmdbId/cast', auth, async (request: FastifyRequest) => {
    const tmdbId = Number((request.params as any).tmdbId);
    const cast = await getOrFetchMovieCast(tmdbId);
    return { cast };
  });

  app.get('/movies/:tmdbId/crew', auth, async (request: FastifyRequest) => {
    const tmdbId = Number((request.params as any).tmdbId);
    const crew = await getOrFetchMovieCrew(tmdbId);
    return { crew };
  });

  app.post('/movies/:tmdbId/metadata/refresh', auth, async (request: FastifyRequest) => {
    const tmdbId = Number((request.params as any).tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return { error: 'Invalid tmdbId' };
    const movie = await forceRefreshMovieMetadata(tmdbId);
    return { movie };
  });

  app.post('/movies/:tmdbId/cast/refresh', auth, async (request: FastifyRequest) => {
    const tmdbId = Number((request.params as any).tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return { error: 'Invalid tmdbId' };
    const { cast, crew } = await forceRefreshMovieCast(tmdbId);
    return { cast, crew };
  });

  app.get('/movies/:tmdbId/images', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number(params(request).tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return reply.status(400).send({ error: 'Invalid tmdbId' });
    const images = await getAvailableImages('movie', tmdbId);
    return images;
  });

  app.put('/movies/:tmdbId/image', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number(params(request).tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return reply.status(400).send({ error: 'Invalid tmdbId' });
    const { imageType, path } = request.body as { imageType: 'hero' | 'poster'; path: string };
    if (!['hero', 'poster'].includes(imageType) || !path) return reply.status(400).send({ error: 'Invalid body' });
    await setImageOverride('movie', tmdbId, imageType, path);
    return { ok: true };
  });
}
