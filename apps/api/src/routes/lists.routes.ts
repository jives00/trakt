import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getLists, createList, getListDetail, getListByType, deleteList,
  addListItem, removeListItem, updateList, setListStremioCatalog, getListMembershipIds,
} from '../services/lists.service';
import { ListType, ListSort } from '@trakt/types';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

const VALID_MEDIA_TYPES = ['movie', 'show', 'episode'];
const VALID_LIST_TYPES: ListType[] = ['watchlist', 'dropped', 'rewatch', 'custom'];
const VALID_SORTS: ListSort[] = ['added_date', 'alpha', 'last_updated', 'random'];

export async function listsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/lists', auth, async (request: FastifyRequest) => {
    return getLists(userId(request));
  });

  app.get<{ Querystring: { mediaType?: string; mediaId?: string } }>(
    '/lists/membership',
    auth,
    async (request, reply) => {
      const { mediaType, mediaId } = request.query;
      const id = Number(mediaId);
      if (!VALID_MEDIA_TYPES.includes(mediaType ?? '') || !Number.isInteger(id) || id <= 0) {
        return reply.status(400).send({ error: 'Invalid mediaType or mediaId' });
      }
      const listIds = await getListMembershipIds(userId(request), mediaType!, id);
      return { listIds };
    },
  );

  app.get<{ Params: { type: string } }>('/lists/by-type/:type', auth, async (request, reply) => {
    const { type } = request.params;
    if (!VALID_LIST_TYPES.includes(type as ListType)) return reply.status(400).send({ error: 'Invalid list type' });
    const list = await getListByType(userId(request), type as ListType);
    if (!list) return reply.status(404).send({ error: 'List not found' });
    return list;
  });

  app.post<{ Body: { name?: string; description?: string } }>('/lists', auth, async (request, reply) => {
    const { name, description } = request.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.status(400).send({ error: 'name is required' });
    }
    return createList(userId(request), name.trim(), description ?? null);
  });

  app.patch<{ Params: { id: string }; Body: { name?: string; description?: string; defaultSort?: string; isPublic?: boolean } }>(
    '/lists/:id',
    auth,
    async (request, reply) => {
      const listId = Number(request.params.id);
      if (!Number.isInteger(listId) || listId <= 0) return reply.status(400).send({ error: 'Invalid id' });
      const { name, description, defaultSort, isPublic } = request.body ?? {};
      if (defaultSort !== undefined && !VALID_SORTS.includes(defaultSort as ListSort)) {
        return reply.status(400).send({ error: 'Invalid defaultSort' });
      }
      try {
        const updated = await updateList(userId(request), listId, { name, description, defaultSort: defaultSort as ListSort | undefined, isPublic });
        if (!updated) return reply.status(404).send({ error: 'List not found' });
        return updated;
      } catch (err: any) {
        if (err.code === 'SYSTEM_LIST') return reply.status(403).send({ error: err.message });
        throw err;
      }
    },
  );

  app.get<{ Params: { id: string } }>('/lists/:id', auth, async (request, reply) => {
    const listId = Number(request.params.id);
    if (!Number.isInteger(listId) || listId <= 0) return reply.status(400).send({ error: 'Invalid id' });
    const list = await getListDetail(userId(request), listId);
    if (!list) return reply.status(404).send({ error: 'List not found' });
    return list;
  });

  app.delete<{ Params: { id: string } }>('/lists/:id', auth, async (request, reply) => {
    const listId = Number(request.params.id);
    if (!Number.isInteger(listId) || listId <= 0) return reply.status(400).send({ error: 'Invalid id' });
    try {
      const deleted = await deleteList(userId(request), listId);
      if (!deleted) return reply.status(404).send({ error: 'List not found' });
      return { deleted: true };
    } catch (err: any) {
      if (err.code === 'SYSTEM_LIST') return reply.status(403).send({ error: err.message });
      throw err;
    }
  });

  app.patch<{ Params: { id: string }; Body: { enabled?: boolean; sort?: string } }>(
    '/lists/:id/stremio-catalog',
    auth,
    async (request, reply) => {
      const listId = Number(request.params.id);
      if (!Number.isInteger(listId) || listId <= 0) return reply.status(400).send({ error: 'Invalid id' });
      const { enabled, sort } = request.body ?? {};
      if (enabled !== undefined && typeof enabled !== 'boolean') return reply.status(400).send({ error: 'enabled must be a boolean' });
      const VALID_CATALOG_SORTS = ['added_date', 'alpha', 'random'];
      if (sort !== undefined && !VALID_CATALOG_SORTS.includes(sort)) return reply.status(400).send({ error: 'Invalid sort' });
      if (enabled === undefined && sort === undefined) return reply.status(400).send({ error: 'enabled or sort required' });
      const updated = await setListStremioCatalog(userId(request), listId, enabled, sort);
      if (!updated) return reply.status(404).send({ error: 'List not found' });
      return { stremioCatalog: enabled, stremioSort: sort };
    },
  );

  app.post<{ Params: { id: string }; Body: { mediaType?: string; mediaId?: number } }>(
    '/lists/:id/items',
    auth,
    async (request, reply) => {
      const listId = Number(request.params.id);
      if (!Number.isInteger(listId) || listId <= 0) return reply.status(400).send({ error: 'Invalid id' });
      const { mediaType, mediaId } = request.body ?? {};
      if (!VALID_MEDIA_TYPES.includes(mediaType ?? '') || !Number.isInteger(mediaId) || (mediaId ?? 0) <= 0) {
        return reply.status(400).send({ error: 'Invalid mediaType or mediaId' });
      }
      const list = await getListDetail(userId(request), listId);
      if (!list) return reply.status(404).send({ error: 'List not found' });
      await addListItem(listId, mediaType! as 'movie' | 'show' | 'episode', mediaId!);
      return { added: true };
    },
  );

  app.delete<{ Params: { id: string; mediaType: string; mediaId: string } }>(
    '/lists/:id/items/:mediaType/:mediaId',
    auth,
    async (request, reply) => {
      const listId = Number(request.params.id);
      const mediaId = Number(request.params.mediaId);
      const { mediaType } = request.params;
      if (!Number.isInteger(listId) || listId <= 0) return reply.status(400).send({ error: 'Invalid id' });
      if (!VALID_MEDIA_TYPES.includes(mediaType) || !Number.isInteger(mediaId) || mediaId <= 0) {
        return reply.status(400).send({ error: 'Invalid mediaType or mediaId' });
      }
      const list = await getListDetail(userId(request), listId);
      if (!list) return reply.status(404).send({ error: 'List not found' });
      const removed = await removeListItem(listId, mediaType, mediaId);
      if (!removed) return reply.status(404).send({ error: 'Item not found' });
      return { removed: true };
    },
  );
}
