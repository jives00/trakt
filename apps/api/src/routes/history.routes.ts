import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getHistory, deleteHistoryEntry } from '../services/history.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

const VALID_TYPES = ['movie', 'episode', 'all'];

export async function historyRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/history', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { type = 'all', page = '1', limit = '20' } = request.query as any;
    if (!VALID_TYPES.includes(type)) return reply.status(400).send({ error: 'Invalid type' });
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    return getHistory(userId(request), type, p, l);
  });

  app.delete('/history/:id', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const id = Number((request.params as any).id);
    if (!Number.isInteger(id) || id <= 0) return reply.status(400).send({ error: 'Invalid id' });
    const deleted = await deleteHistoryEntry(userId(request), id);
    if (!deleted) return reply.status(404).send({ error: 'Not found' });
    return { deleted: true };
  });
}
