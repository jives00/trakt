import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getHistory, deleteHistoryEntry } from '../services/history.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

const VALID_TYPES = ['movie', 'episode', 'all'];

export async function historyRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get<{ Querystring: { type?: string; page?: string; limit?: string; date?: string; tzOffset?: string } }>(
    '/history',
    auth,
    async (request, reply) => {
      const { type = 'all', page = '1', limit = '20', date, tzOffset } = request.query;
      if (!VALID_TYPES.includes(type)) return reply.status(400).send({ error: 'Invalid type' });
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return reply.status(400).send({ error: 'Invalid date format' });
      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const raw = parseInt(tzOffset ?? '0', 10);
      const clampedOffset = Math.max(-840, Math.min(840, isNaN(raw) ? 0 : raw));
      const sign = clampedOffset > 0 ? '-' : '+';
      const abs = Math.abs(clampedOffset);
      const tzString = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
      return getHistory(userId(request), type as 'movie' | 'episode' | 'all', p, l, date, tzString);
    },
  );

  app.delete<{ Params: { id: string } }>('/history/:id', auth, async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) return reply.status(400).send({ error: 'Invalid id' });
    const deleted = await deleteHistoryEntry(userId(request), id);
    if (!deleted) return reply.status(404).send({ error: 'Not found' });
    return { deleted: true };
  });
}
