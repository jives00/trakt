import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getProgress } from '../services/progress.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

export async function progressRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/progress', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { status = 'all' } = request.query as any;
    if (!['airing', 'ended', 'all'].includes(status)) {
      return reply.status(400).send({ error: 'Invalid status' });
    }
    return getProgress(userId(request), status);
  });
}
