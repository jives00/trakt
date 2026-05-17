import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getRatings, upsertRating, deleteRating } from '../services/ratings.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

const VALID_TYPES = ['movie', 'show', 'episode', 'all'];
const VALID_MEDIA_TYPES = ['movie', 'show', 'episode'];

export async function ratingsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get<{ Querystring: { type?: string; sort?: string; page?: string; limit?: string } }>(
    '/ratings',
    auth,
    async (request, reply) => {
      const { type = 'all', sort = 'date', page = '1', limit = '20' } = request.query;
      if (!VALID_TYPES.includes(type)) return reply.status(400).send({ error: 'Invalid type' });
      if (!['rating', 'date'].includes(sort)) return reply.status(400).send({ error: 'Invalid sort' });
      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      return getRatings(userId(request), type as 'movie' | 'show' | 'episode' | 'all', sort as 'rating' | 'date', p, l);
    },
  );

  app.post<{ Body: { mediaType?: string; mediaId?: number; rating?: number } }>(
    '/ratings',
    auth,
    async (request, reply) => {
      const { mediaType, mediaId, rating } = request.body ?? {};
      if (!VALID_MEDIA_TYPES.includes(mediaType ?? '')) return reply.status(400).send({ error: 'Invalid mediaType' });
      if (!Number.isInteger(mediaId) || (mediaId ?? 0) <= 0) return reply.status(400).send({ error: 'Invalid mediaId' });
      if (!Number.isInteger(rating) || (rating ?? 0) < 1 || (rating ?? 0) > 10) {
        return reply.status(400).send({ error: 'rating must be 1–10' });
      }
      await upsertRating(userId(request), mediaType! as 'movie' | 'show' | 'episode', mediaId!, rating!);
      return { mediaType, mediaId, rating };
    },
  );

  app.put<{ Params: { mediaType: string; mediaId: string }; Body: { rating?: number } }>(
    '/ratings/:mediaType/:mediaId',
    auth,
    async (request, reply) => {
      const { mediaType, mediaId: mediaIdStr } = request.params;
      const mediaId = Number(mediaIdStr);
      const { rating } = request.body ?? {};
      if (!VALID_MEDIA_TYPES.includes(mediaType)) return reply.status(400).send({ error: 'Invalid mediaType' });
      if (!Number.isInteger(mediaId) || mediaId <= 0) return reply.status(400).send({ error: 'Invalid mediaId' });
      if (!Number.isInteger(rating) || (rating ?? 0) < 1 || (rating ?? 0) > 10) {
        return reply.status(400).send({ error: 'rating must be 1–10' });
      }
      await upsertRating(userId(request), mediaType as 'movie' | 'show' | 'episode', mediaId, rating!);
      return { mediaType, mediaId, rating };
    },
  );

  app.delete<{ Params: { mediaType: string; mediaId: string } }>(
    '/ratings/:mediaType/:mediaId',
    auth,
    async (request, reply) => {
      const { mediaType, mediaId: mediaIdStr } = request.params;
      const mediaId = Number(mediaIdStr);
      if (!VALID_MEDIA_TYPES.includes(mediaType)) return reply.status(400).send({ error: 'Invalid mediaType' });
      if (!Number.isInteger(mediaId) || mediaId <= 0) return reply.status(400).send({ error: 'Invalid mediaId' });
      const deleted = await deleteRating(userId(request), mediaType as 'movie' | 'show' | 'episode', mediaId);
      if (!deleted) return reply.status(404).send({ error: 'Rating not found' });
      return { deleted: true };
    },
  );
}
