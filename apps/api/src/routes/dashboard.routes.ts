import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getUpNext, getSchedule } from '../services/dashboard.service';
import { getDashboardStats, getRecentItems } from '../services/stats.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

export async function dashboardRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/dashboard/up-next', auth, async (request: FastifyRequest) => {
    return getUpNext(userId(request));
  });

  app.get('/dashboard/schedule', auth, async (request: FastifyRequest) => {
    const { range = '6', type = 'tv' } = request.query as any;
    const days = Math.min(90, Math.max(1, parseInt(range, 10) || 6));
    return getSchedule(userId(request), days, type);
  });

  app.get('/dashboard/recent', auth, async (request: FastifyRequest) => {
    const { limit = '10' } = request.query as any;
    const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    return getRecentItems(userId(request), l);
  });

  app.get('/dashboard/stats', auth, async (request: FastifyRequest) => {
    return getDashboardStats(userId(request));
  });
}
