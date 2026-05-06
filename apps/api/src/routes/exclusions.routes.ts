import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { CreateExclusionBody } from '@trakt/types';
import { getExclusions, createExclusion, deleteExclusion } from '../services/exclusions.service';

export async function exclusionsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/settings/exclusions', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { integration } = request.query as any;

    if (integration && !['emby', 'stremio', 'kodi'].includes(integration)) {
      return reply.status(400).send({ error: 'Invalid integration' });
    }

    return getExclusions(integration);
  });

  app.post('/settings/exclusions', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = CreateExclusionBody.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: result.error.flatten() });
    }

    try {
      const exclusion = await createExclusion(result.data);
      return reply.status(201).send(exclusion);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to create exclusion' });
    }
  });

  app.delete('/settings/exclusions/:id', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;

    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
      return reply.status(400).send({ error: 'Invalid id' });
    }

    try {
      const deleted = await deleteExclusion(Number(id));
      if (!deleted) {
        return reply.status(404).send({ error: 'Exclusion not found' });
      }
      return reply.status(204).send();
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to delete exclusion' });
    }
  });
}
