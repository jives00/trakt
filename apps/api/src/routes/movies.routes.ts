import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getOrFetchMovie, getOrFetchMovieCast, getOrFetchMovieCrew, forceRefreshMovieMetadata, forceRefreshMovieCast } from '../services/movies.service';
import {
  getMovieStatus, toggleWatchlist, toggleCollection,
  markMovieWatched, unmarkMovieWatched,
} from '../services/user-media.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
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
    const movie = await getOrFetchMovie(tmdbId);
    await markMovieWatched(userId(request), movie.id);
    return { watched: true };
  });

  app.delete('/movies/:tmdbId/watched', auth, async (request: FastifyRequest) => {
    const tmdbId = Number((request.params as any).tmdbId);
    const movie = await getOrFetchMovie(tmdbId);
    await unmarkMovieWatched(userId(request), movie.id);
    return { watched: false };
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
    const added = await toggleWatchlist(userId(request), 'movie', movie.id);
    return { inWatchlist: added };
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
    const added = await toggleCollection(userId(request), 'movie', movie.id);
    return { inCollection: added };
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
}
