import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getMovieDiscover, getShowDiscover, isDiscoverPeriod, isMovieDiscoverCategory, isShowDiscoverCategory, isValidDiscoverYear } from '../services/discover.service';

export async function discoverRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/discover/movies', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const category = query.category ?? 'trending';
    const page = Number(query.page ?? '1');
    const region = query.region ?? 'US';
    const period = query.period ?? 'all_time';
    const yearRaw = query.year;
    const year = yearRaw ? Number(yearRaw) : null;
    const englishOnly = query.englishOnly === 'true';

    if (!isMovieDiscoverCategory(category)) {
      return reply.status(400).send({ error: 'Invalid movie discover category' });
    }
    if (!isDiscoverPeriod(period)) {
      return reply.status(400).send({ error: 'Invalid discover period' });
    }
    if (!Number.isInteger(page) || page < 1 || page > 500) {
      return reply.status(400).send({ error: 'Invalid page' });
    }
    if (yearRaw && !isValidDiscoverYear(yearRaw)) {
      return reply.status(400).send({ error: 'Invalid year' });
    }

    return getMovieDiscover(category, page, region, period, year, englishOnly);
  });

  app.get('/discover/shows', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const category = query.category ?? 'trending';
    const page = Number(query.page ?? '1');
    const period = query.period ?? 'all_time';
    const yearRaw = query.year;
    const year = yearRaw ? Number(yearRaw) : null;
    const englishOnly = query.englishOnly === 'true';

    if (!isShowDiscoverCategory(category)) {
      return reply.status(400).send({ error: 'Invalid show discover category' });
    }
    if (!isDiscoverPeriod(period)) {
      return reply.status(400).send({ error: 'Invalid discover period' });
    }
    if (!Number.isInteger(page) || page < 1 || page > 500) {
      return reply.status(400).send({ error: 'Invalid page' });
    }
    if (yearRaw && !isValidDiscoverYear(yearRaw)) {
      return reply.status(400).send({ error: 'Invalid year' });
    }

    return getShowDiscover(category, page, period, year, englishOnly);
  });
}
