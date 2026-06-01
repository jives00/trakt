import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getUpNext } from '../services/up-next.service';
import { getSchedule } from '../services/schedule.service';
import { getDashboardStats, getRecentItems, getDashboardArt } from '../services/stats-summary.service';
import { backfillAirTimes } from '../services/shows.service';
import { getShowRecommendations, getMovieRecommendations } from '../services/recommendations.service';

interface CacheEntry<T> { data: T; expiresAt: number }
function makeCache<T>(ttlMs: number) {
  const store = new Map<string, CacheEntry<T>>();
  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry || Date.now() > entry.expiresAt) { store.delete(key); return undefined; }
      return entry.data;
    },
    set(key: string, data: T) { store.set(key, { data, expiresAt: Date.now() + ttlMs }); },
  };
}

const artCache = makeCache<string[]>(5 * 60 * 1000);      // 5 min
const recentCache = makeCache<unknown[]>(60 * 1000);       // 60 sec

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
    const uid = userId(request);
    const key = `${uid}:${l}`;
    const cached = recentCache.get(key);
    if (cached) return cached;
    const data = await getRecentItems(uid, l);
    recentCache.set(key, data);
    return data;
  });

  app.get<{ Querystring: { tzOffset?: string } }>('/dashboard/stats', auth, async (request) => {
    const raw = parseInt(request.query.tzOffset ?? '0', 10);
    const clampedOffset = Math.max(-840, Math.min(840, isNaN(raw) ? 0 : raw));
    const sign = clampedOffset > 0 ? '-' : '+';
    const abs = Math.abs(clampedOffset);
    const tzString = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
    return getDashboardStats(userId(request), tzString);
  });

  app.get('/dashboard/recommendations/shows', auth, async (request: FastifyRequest) => {
    return getShowRecommendations(userId(request));
  });

  app.get('/dashboard/recommendations/movies', auth, async (request: FastifyRequest) => {
    return getMovieRecommendations(userId(request));
  });

  app.get('/dashboard/art', auth, async (request: FastifyRequest) => {
    const uid = userId(request);
    const key = String(uid);
    const cached = artCache.get(key);
    if (cached) return cached;
    const data = await getDashboardArt(uid);
    artCache.set(key, data);
    return data;
  });

  app.post('/dashboard/backfill-air-times', auth, async () => {
    return backfillAirTimes();
  });
}
