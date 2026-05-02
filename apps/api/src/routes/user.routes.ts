import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { UpdateProfileBody } from '@trakt/types';
import { getProfile, updateProfile } from '../services/user.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

export async function userRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/user/profile', auth, async (request: FastifyRequest) => {
    return getProfile(userId(request));
  });

  app.patch('/user/profile', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = UpdateProfileBody.safeParse(request.body);
      if (!result.success) {
        console.warn('Zod validation failed:', result.error);
        return reply.status(400).send({ error: 'Invalid request body' });
      }
      return updateProfile(userId(request), result.data.displayName);
    } catch (err) {
      console.error('PATCH /user/profile error:', err);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
