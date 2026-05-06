import { FastifyInstance } from 'fastify';
import { EmbyWebhookPayload } from '@trakt/types';
import { authenticateScrobble } from '../middleware/auth';
import { handleEmbyScrobble } from '../services/scrobble.service';

export async function scrobbleRoutes(app: FastifyInstance) {
  app.post<{ Body: EmbyWebhookPayload }>('/scrobble/emby', { preHandler: authenticateScrobble }, async (request, reply) => {
    try {
      const parsed = EmbyWebhookPayload.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid payload' });
      }

      await handleEmbyScrobble(parsed.data);
      return reply.send({});
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
