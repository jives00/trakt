import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getRatings, upsertRating, deleteRating } from '../services/ratings.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

const VALID_TYPES = ['movie', 'show', 'episode', 'all'];
const VALID_MEDIA_TYPES = ['movie', 'show', 'episode'];

export async function ratingsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/ratings', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { type = 'all', sort = 'date', page = '1', limit = '20' } = request.query as any;
    if (!VALID_TYPES.includes(type)) return reply.status(400).send({ error: 'Invalid type' });
    if (!['rating', 'date'].includes(sort)) return reply.status(400).send({ error: 'Invalid sort' });
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    return getRatings(userId(request), type, sort, p, l);
  });

  app.post('/ratings', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { mediaType, mediaId, rating } = request.body as any;
    if (!VALID_MEDIA_TYPES.includes(mediaType)) return reply.status(400).send({ error: 'Invalid mediaType' });
    if (!Number.isInteger(mediaId) || mediaId <= 0) return reply.status(400).send({ error: 'Invalid mediaId' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      return reply.status(400).send({ error: 'rating must be 1–10' });
    }
    await upsertRating(userId(request), mediaType, mediaId, rating);
    return { mediaType, mediaId, rating };
  });

  app.put('/ratings/:mediaType/:mediaId', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { mediaType, mediaId: mediaIdStr } = request.params as any;
    const mediaId = Number(mediaIdStr);
    const { rating } = request.body as any;
    if (!VALID_MEDIA_TYPES.includes(mediaType)) return reply.status(400).send({ error: 'Invalid mediaType' });
    if (!Number.isInteger(mediaId) || mediaId <= 0) return reply.status(400).send({ error: 'Invalid mediaId' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      return reply.status(400).send({ error: 'rating must be 1–10' });
    }
    await upsertRating(userId(request), mediaType, mediaId, rating);
    return { mediaType, mediaId, rating };
  });

  app.delete(
    '/ratings/:mediaType/:mediaId',
    auth,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { mediaType, mediaId: mediaIdStr } = request.params as any;
      const mediaId = Number(mediaIdStr);
      if (!VALID_MEDIA_TYPES.includes(mediaType)) return reply.status(400).send({ error: 'Invalid mediaType' });
      if (!Number.isInteger(mediaId) || mediaId <= 0) return reply.status(400).send({ error: 'Invalid mediaId' });
      const deleted = await deleteRating(userId(request), mediaType, mediaId);
      if (!deleted) return reply.status(404).send({ error: 'Rating not found' });
      return { deleted: true };
    },
  );
}
