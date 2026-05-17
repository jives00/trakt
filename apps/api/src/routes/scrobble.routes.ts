import { FastifyInstance, FastifyRequest } from 'fastify';
import { EmbyWebhookPayload } from '@trakt/types';
import { authenticateScrobble, authenticate } from '../middleware/auth';
import { handleEmbyScrobble, getNowPlaying } from '../services/scrobble.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

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

  app.get('/scrobble/now-playing', { preHandler: authenticate }, async (request, reply) => {
    try {
      const item = await getNowPlaying(userId(request));
      if (!item) {
        return reply.status(204).send();
      }
      return reply.send(item);
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
