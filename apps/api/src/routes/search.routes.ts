import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { searchTmdb } from '../services/tmdb.client';

export async function searchRoutes(app: FastifyInstance) {
  app.get(
    '/search',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { q } = request.query as { q?: string };
      if (!q || q.trim().length === 0) {
        return reply.status(400).send({ error: 'Missing query parameter q' });
      }
      return await searchTmdb(q.trim());
    },
  );
}
