import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getStatsAllTime, getStatsYear, getStatsMonth } from '../services/stats.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

export async function statsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/stats/alltime', auth, async (request: FastifyRequest) => {
    return getStatsAllTime(userId(request));
  });

  app.get('/stats/year/:year', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const year = Number((request.params as any).year);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return reply.status(400).send({ error: 'Invalid year' });
    }
    return getStatsYear(userId(request), year);
  });

  app.get('/stats/month/:year/:month', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const year = Number((request.params as any).year);
    const month = Number((request.params as any).month);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return reply.status(400).send({ error: 'Invalid year' });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return reply.status(400).send({ error: 'Invalid month' });
    }
    return getStatsMonth(userId(request), year, month);
  });
}
