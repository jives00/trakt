import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getUpNext, getSchedule } from '../services/dashboard.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

export async function dashboardRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/dashboard/up-next', auth, async (request: FastifyRequest) => {
    return getUpNext(userId(request));
  });

  app.get('/dashboard/schedule', auth, async (request: FastifyRequest) => {
    return getSchedule(userId(request));
  });
}
