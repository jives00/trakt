import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { startPollLoop, stopPollLoop, getTraktToken } from '../services/trakt-poll.service';

const MANIFEST = {
  id: 'community.trakt-personal',
  version: '1.0.0',
  name: 'Personal Trakt Tracker',
  description: 'Tracks watch history to your personal Trakt clone',
  resources: ['subtitles'],
  types: ['movie', 'series'],
  catalogs: [],
  idPrefixes: ['tt'],
};

export async function stremioAddonRoutes(app: FastifyInstance) {
  app.get('/manifest.json', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(MANIFEST);
  });

  app.get<{ Params: { type: string; id: string; extra: string } }>(
    '/subtitles/:type/:id/:extra',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { type, id } = request.params;

      if (!id.startsWith('tt') || !/^tt\d+$/.test(id)) {
        return reply.send({ subtitles: [] });
      }

      const contentType = type === 'series' ? 'series' : type === 'movie' ? 'movie' : null;

      if (contentType) {
        try {
          const token = await getTraktToken();
          if (token?.username) {
            startPollLoop(id, contentType, token.username);
          }
        } catch (err) {
          console.error('Failed to start poll loop:', err);
        }
      }

      return reply.send({ subtitles: [] });
    }
  );
}
