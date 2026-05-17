import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getProgress } from '../services/progress.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

export async function progressRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get<{ Querystring: { status?: string } }>('/progress', auth, async (request, reply) => {
    const { status = 'all' } = request.query;
    if (!['airing', 'ended', 'all'].includes(status)) {
      return reply.status(400).send({ error: 'Invalid status' });
    }
    return getProgress(userId(request), status as 'airing' | 'ended' | 'all');
  });
}
