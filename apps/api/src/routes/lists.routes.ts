import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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

  app.get('/lists/membership', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { mediaType, mediaId } = request.query as any;
    const id = Number(mediaId);
    if (!VALID_MEDIA_TYPES.includes(mediaType) || !Number.isInteger(id) || id <= 0) {
      return reply.status(400).send({ error: 'Invalid mediaType or mediaId' });
    }
    const listIds = await getListMembershipIds(userId(request), mediaType, id);
    return { listIds };
  });

  app.get('/lists/by-type/:type', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { type } = request.params as any;
    if (!VALID_LIST_TYPES.includes(type)) return reply.status(400).send({ error: 'Invalid list type' });
    const list = await getListByType(userId(request), type as ListType);
    if (!list) return reply.status(404).send({ error: 'List not found' });
    return list;
  });

  app.post('/lists', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, description } = request.body as any;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.status(400).send({ error: 'name is required' });
    }
    return createList(userId(request), name.trim(), description ?? null);
  });

  app.patch('/lists/:id', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const listId = Number((request.params as any).id);
    if (!Number.isInteger(listId) || listId <= 0) return reply.status(400).send({ error: 'Invalid id' });
    const { name, description, defaultSort, isPublic } = request.body as any;
    if (defaultSort !== undefined && !VALID_SORTS.includes(defaultSort)) {
      return reply.status(400).send({ error: 'Invalid defaultSort' });
    }
    try {
      const updated = await updateList(userId(request), listId, { name, description, defaultSort, isPublic });
      if (!updated) return reply.status(404).send({ error: 'List not found' });
      return updated;
    } catch (err: any) {
      if (err.code === 'SYSTEM_LIST') return reply.status(403).send({ error: err.message });
      throw err;
    }
  });

  app.get('/lists/:id', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const listId = Number((request.params as any).id);
    if (!Number.isInteger(listId) || listId <= 0) return reply.status(400).send({ error: 'Invalid id' });
    const list = await getListDetail(userId(request), listId);
    if (!list) return reply.status(404).send({ error: 'List not found' });
    return list;
  });

  app.delete('/lists/:id', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const listId = Number((request.params as any).id);
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

  app.patch('/lists/:id/stremio-catalog', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const listId = Number((request.params as any).id);
    if (!Number.isInteger(listId) || listId <= 0) return reply.status(400).send({ error: 'Invalid id' });
    const { enabled } = request.body as any;
    if (typeof enabled !== 'boolean') return reply.status(400).send({ error: 'enabled must be a boolean' });
    const updated = await setListStremioCatalog(userId(request), listId, enabled);
    if (!updated) return reply.status(404).send({ error: 'List not found' });
    return { stremioCatalog: enabled };
  });

  app.post('/lists/:id/items', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const listId = Number((request.params as any).id);
    if (!Number.isInteger(listId) || listId <= 0) return reply.status(400).send({ error: 'Invalid id' });
    const { mediaType, mediaId } = request.body as any;
    if (!VALID_MEDIA_TYPES.includes(mediaType) || !Number.isInteger(mediaId) || mediaId <= 0) {
      return reply.status(400).send({ error: 'Invalid mediaType or mediaId' });
    }
    const list = await getListDetail(userId(request), listId);
    if (!list) return reply.status(404).send({ error: 'List not found' });
    await addListItem(listId, mediaType, mediaId);
    return { added: true };
  });

  app.delete(
    '/lists/:id/items/:mediaType/:mediaId',
    auth,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const listId = Number((request.params as any).id);
      const mediaId = Number((request.params as any).mediaId);
      const { mediaType } = request.params as any;
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
