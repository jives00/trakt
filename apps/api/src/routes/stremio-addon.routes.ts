import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { startPollLoop, getTraktToken } from '../services/trakt-poll.service';
import { getExportableLists, getExportableList } from '../services/export.service';
import type { StremioCatalogEntry, StremioMetaObject } from '@trakt/types';

const SINGLE_USER_ID = 1;

export async function stremioAddonRoutes(app: FastifyInstance) {
  app.get('/manifest.json', async (request: FastifyRequest, reply: FastifyReply) => {
    const lists = await getExportableLists(SINGLE_USER_ID);
    const catalogs: StremioCatalogEntry[] = [];
    for (const list of lists) {
      if (list.movieCount > 0) catalogs.push({ type: 'movie',  id: `personal-${list.slug}-movie`,  name: `Trakt App - ${list.name}` });
      if (list.showCount  > 0) catalogs.push({ type: 'series', id: `personal-${list.slug}-series`, name: `Trakt App - ${list.name}` });
    }
    const catalogKey = catalogs.map((c) => c.id).join(',');
    const version = '1.0.' + parseInt(createHash('md5').update(catalogKey).digest('hex').slice(0, 8), 16);
    return reply.send({
      id: 'community.trakt-personal',
      version,
      name: 'Personal Trakt Tracker',
      description: 'Tracks watch history and exposes personal lists as catalogs',
      resources: ['subtitles', 'catalog'],
      types: ['movie', 'series'],
      catalogs,
      idPrefixes: ['tt'],
    });
  });

  app.get<{ Params: { type: string; id: string; extra: string } }>(
    '/subtitles/:type/:id/:extra',
    async (request: FastifyRequest<{ Params: { type: string; id: string; extra: string } }>, reply: FastifyReply) => {
      const { type, id } = request.params as { type: string; id: string; extra: string };
      console.log('🎬 Stremio subtitle request:', { type, id });

      // Extract IMDb ID from Stremio format: "tt123456" (movie) or "tt123456:5:2" (episode season:number)
      const imdbIdMatch = id.match(/^(tt\d+)/);
      const imdbId = imdbIdMatch?.[1];
      if (!imdbId) {
        return reply.send({ subtitles: [] });
      }

      const contentType = type === 'series' ? 'series' : type === 'movie' ? 'movie' : null;

      if (contentType) {
        try {
          const token = await getTraktToken();
          console.log('🔍 Trakt token check:', { hasToken: !!token, hasUsername: !!token?.username });
          if (token?.username) {
            startPollLoop(imdbId, contentType, token.username);
          } else {
            console.log('⚠️  No Trakt token or username found - poll loop not started');
          }
        } catch (err) {
          console.error('Failed to start poll loop:', err);
        }
      }

      return reply.send({ subtitles: [] });
    }
  );

  app.get<{ Params: { type: string; id: string } }>(
    '/catalog/:type/:id.json',
    async (request: FastifyRequest<{ Params: { type: string; id: string } }>, reply: FastifyReply) => {
      const { type, id } = request.params;
      if (!id.startsWith('personal-')) return reply.send({ metas: [] });

      const withoutPrefix = id.slice('personal-'.length);
      const isMovie = type === 'movie';
      const slug = isMovie ? withoutPrefix.replace(/-movie$/, '') : withoutPrefix.replace(/-series$/, '');

      const result = await getExportableList(SINGLE_USER_ID, slug);
      if (!result) return reply.send({ metas: [] });

      const stremioType = isMovie ? 'movie' : 'series';
      const mediaFilter = isMovie ? 'movie' : 'show';

      const metas: StremioMetaObject[] = result.items
        .filter((item) => item.mediaType === mediaFilter)
        .map((item) => ({
          id: item.imdbId ?? `tmdb:${item.tmdbId}`,
          type: stremioType,
          name: item.title ?? 'Unknown',
          ...(item.posterPath ? { poster: `https://image.tmdb.org/t/p/w500${item.posterPath}` } : {}),
          ...(item.year ? { year: item.year } : {}),
        }));

      return reply.send({ metas });
    }
  );
}
