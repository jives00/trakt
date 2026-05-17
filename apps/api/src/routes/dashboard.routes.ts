import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getUpNext } from '../services/up-next.service';
import { getSchedule } from '../services/schedule.service';
import { getDashboardStats, getRecentItems, getDashboardArt } from '../services/stats-summary.service';
import { backfillAirTimes } from '../services/shows.service';
import { getShowRecommendations, getMovieRecommendations } from '../services/recommendations.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

export async function dashboardRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/dashboard/up-next', auth, async (request: FastifyRequest) => {
    return getUpNext(userId(request));
  });

  app.get<{ Querystring: { range?: string; type?: string; startDays?: string } }>(
    '/dashboard/schedule',
    auth,
    async (request) => {
      const { range = '7', type = 'all', startDays: sd = '0' } = request.query;
      const days = Math.min(90, Math.max(1, parseInt(range, 10) || 7));
      const startDays = Math.min(365, Math.max(0, parseInt(sd, 10) || 0));
      return getSchedule(userId(request), days, type, startDays);
    },
  );

  app.get<{ Querystring: { limit?: string } }>('/dashboard/recent', auth, async (request) => {
    const { limit = '10' } = request.query;
    const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    return getRecentItems(userId(request), l);
  });

  app.get('/dashboard/stats', auth, async (request: FastifyRequest) => {
    return getDashboardStats(userId(request));
  });

  app.get('/dashboard/recommendations/shows', auth, async (request: FastifyRequest) => {
    return getShowRecommendations(userId(request));
  });

  app.get('/dashboard/recommendations/movies', auth, async (request: FastifyRequest) => {
    return getMovieRecommendations(userId(request));
  });

  app.get('/dashboard/art', auth, async (request: FastifyRequest) => {
    return getDashboardArt(userId(request));
  });

  app.post('/dashboard/backfill-air-times', auth, async () => {
    return backfillAirTimes();
  });
}
