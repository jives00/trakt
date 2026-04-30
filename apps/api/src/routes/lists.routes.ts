import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getLists, createList, getListDetail, deleteList, addListItem, removeListItem,
} from '../services/lists.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

const VALID_MEDIA_TYPES = ['movie', 'show', 'episode'];

export async function listsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/lists', auth, async (request: FastifyRequest) => {
    return getLists(userId(request));
  });

  app.post('/lists', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, description } = request.body as any;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.status(400).send({ error: 'name is required' });
    }
    return createList(userId(request), name.trim(), description ?? null);
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
    const deleted = await deleteList(userId(request), listId);
    if (!deleted) return reply.status(404).send({ error: 'List not found' });
    return { deleted: true };
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
