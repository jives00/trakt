import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    const code = (err as any)?.code as string | undefined;
    if (typeof code === 'string' && code.startsWith('FST_JWT')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    throw err;
  }
}
