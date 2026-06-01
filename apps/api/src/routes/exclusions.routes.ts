import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../middleware/auth';
import { CreateExclusionBody } from '@trakt/types';
import { getExclusions, createExclusion, deleteExclusion } from '../services/exclusions.service';

export async function exclusionsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get<{ Querystring: { integration?: string } }>(
    '/settings/exclusions',
    auth,
    async (request, reply) => {
      const { integration } = request.query;

      if (integration && !['emby', 'stremio', 'kodi', 'nuvio'].includes(integration)) {
        return reply.status(400).send({ error: 'Invalid integration' });
      }

      return getExclusions(integration);
    },
  );

  app.post('/settings/exclusions', auth, async (request: FastifyRequest, reply) => {
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

  app.delete<{ Params: { id: string } }>(
    '/settings/exclusions/:id',
    auth,
    async (request, reply) => {
      const id = Number(request.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        return reply.status(400).send({ error: 'Invalid id' });
      }

      try {
        const deleted = await deleteExclusion(id);
        if (!deleted) {
          return reply.status(404).send({ error: 'Exclusion not found' });
        }
        return reply.status(204).send();
      } catch (err) {
        return reply.status(500).send({ error: 'Failed to delete exclusion' });
      }
    },
  );
}
