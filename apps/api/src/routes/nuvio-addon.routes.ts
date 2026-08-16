import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import {
  getExportableLists,
  getExportableList,
  filterShowsWithUnwatchedEpisodes,
} from '../services/export.service';
import type { AddonCatalogEntry, AddonMetaObject } from '@trakt/types';

const SINGLE_USER_ID = 1;

export async function nuvioAddonRoutes(app: FastifyInstance) {
  app.get('/manifest.json', async (_request: FastifyRequest, reply: FastifyReply) => {
    const lists = await getExportableLists(SINGLE_USER_ID);
    const catalogs: AddonCatalogEntry[] = [];
    for (const list of lists) {
      if (list.movieCount > 0) catalogs.push({ type: 'movie',  id: `personal-${list.slug}-movie`,  name: `Trakt App - ${list.name}` });
      if (list.showCount  > 0) catalogs.push({ type: 'series', id: `personal-${list.slug}-series`, name: `Trakt App - ${list.name}` });
    }
    const catalogKey = catalogs.map((c) => c.id).join(',');
    const version = '1.0.' + parseInt(createHash('md5').update(catalogKey).digest('hex').slice(0, 8), 16);
    return reply.send({
      id: 'community.trakt-nuvio',
      version,
      name: 'Personal Trakt Tracker (Nuvio)',
      description: 'Exposes personal lists as catalogs for NuvioTV',
      resources: ['catalog'],
      types: ['movie', 'series'],
      catalogs,
      idPrefixes: ['tt'],
    });
  });

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

      let items = result.items.filter((item) => item.mediaType === mediaFilter);

      if (!isMovie) {
        const unwatched = await filterShowsWithUnwatchedEpisodes(
          SINGLE_USER_ID,
          items.map((item) => item.mediaId),
        );
        items = items.filter((item) => unwatched.has(item.mediaId));
      }

      const metas: AddonMetaObject[] = items
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
