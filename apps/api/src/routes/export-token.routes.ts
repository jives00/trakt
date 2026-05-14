import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getExportToken, rotateExportToken } from '../services/export-token.service';

function getUserId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

export async function exportTokenRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/settings/export-token', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const token = await getExportToken(getUserId(request));
    return reply.send({ token });
  });

  app.post('/settings/export-token/rotate', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const token = await rotateExportToken(getUserId(request));
    return reply.send({ token });
  });
}
