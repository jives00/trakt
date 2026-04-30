import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getWatchlist } from '../services/collection.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

export async function watchlistRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/watchlist', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { type = 'all' } = request.query as any;
    if (!['movie', 'show', 'all'].includes(type)) {
      return reply.status(400).send({ error: 'Invalid type' });
    }
    return getWatchlist(userId(request), type);
  });
}
