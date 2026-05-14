import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserByExportToken } from '../services/export-token.service';
import { getExportableList, ExportableItem } from '../services/export.service';

type FeedsParams = { slugOrId: string };
type FeedsQuery = { token?: string; mediaType?: string };

function rssGuid(item: ExportableItem): string {
  if (item.mediaType === 'movie') {
    return item.imdbId ? `imdb://${item.imdbId}` : `tmdb://${item.tmdbId}`;
  }
  return item.tvdbId ? `tvdb://${item.tvdbId}` : `tmdb://${item.tmdbId}`;
}

function rssDate(addedAt: string): string {
  return new Date(addedAt).toUTCString();
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function exportFeedsRoutes(app: FastifyInstance) {
  app.get<{ Params: FeedsParams; Querystring: FeedsQuery }>(
    '/export/lists/:slugOrId/rss',
    async (request: FastifyRequest<{ Params: FeedsParams; Querystring: FeedsQuery }>, reply: FastifyReply) => {
      const { token, mediaType = 'all' } = request.query;
      if (!token) return reply.status(401).send({ error: 'Missing token' });

      const userId = await getUserByExportToken(token);
      if (!userId) return reply.status(401).send({ error: 'Invalid token' });

      const result = await getExportableList(userId, request.params.slugOrId);
      if (!result) return reply.status(404).send({ error: 'List not found' });

      const items = result.items.filter((i) => {
        if (mediaType === 'movie') return i.mediaType === 'movie';
        if (mediaType === 'show') return i.mediaType === 'show';
        return true;
      });

      const itemsXml = items
        .map((item) => {
          const title = item.title ? escapeXml(`${item.title}${item.year ? ` (${item.year})` : ''}`) : 'Unknown';
          return `    <item>\n      <title>${title}</title>\n      <pubDate>${rssDate(item.addedAt)}</pubDate>\n      <guid isPermaLink="false">${rssGuid(item)}</guid>\n    </item>`;
        })
        .join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>${escapeXml(result.list.name)}</title>\n    <description>Exported from personal Trakt</description>\n${itemsXml}\n  </channel>\n</rss>`;

      return reply.type('application/rss+xml').send(xml);
    },
  );

  app.get<{ Params: FeedsParams; Querystring: FeedsQuery }>(
    '/export/lists/:slugOrId/stevenlu',
    async (request: FastifyRequest<{ Params: FeedsParams; Querystring: FeedsQuery }>, reply: FastifyReply) => {
      const { token } = request.query;
      if (!token) return reply.status(401).send({ error: 'Missing token' });

      const userId = await getUserByExportToken(token);
      if (!userId) return reply.status(401).send({ error: 'Invalid token' });

      const result = await getExportableList(userId, request.params.slugOrId);
      if (!result) return reply.status(404).send({ error: 'List not found' });

      const movies = result.items
        .filter((i) => i.mediaType === 'movie' && i.title)
        .map((i) => ({
          title: i.title!,
          ...(i.imdbId ? { imdb_id: i.imdbId } : {}),
          ...(i.posterPath ? { poster_url: `https://image.tmdb.org/t/p/w500${i.posterPath}` } : {}),
        }));

      return reply.send(movies);
    },
  );

  app.get<{ Params: FeedsParams; Querystring: FeedsQuery }>(
    '/export/lists/:slugOrId/sonarr',
    async (request: FastifyRequest<{ Params: FeedsParams; Querystring: FeedsQuery }>, reply: FastifyReply) => {
      const { token } = request.query;
      if (!token) return reply.status(401).send({ error: 'Missing token' });

      const userId = await getUserByExportToken(token);
      if (!userId) return reply.status(401).send({ error: 'Invalid token' });

      const result = await getExportableList(userId, request.params.slugOrId);
      if (!result) return reply.status(404).send({ error: 'List not found' });

      const shows = result.items
        .filter((i) => i.mediaType === 'show' && i.tvdbId)
        .map((i) => ({
          tvdbId: Number(i.tvdbId),
          ...(i.title ? { title: i.title } : {}),
          ...(i.tmdbId ? { tmdbId: i.tmdbId } : {}),
          ...(i.imdbId ? { imdbId: i.imdbId } : {}),
        }));

      return reply.send(shows);
    },
  );
}
