import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import rateLimitPlugin from '@fastify/rate-limit';
import { LoginBody } from '@trakt/types';
import {
  findUserByUsername,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  validateRefreshToken,
  deleteRefreshToken,
} from '../services/auth.service';

const COOKIE = 'refreshToken';

export async function authRoutes(app: FastifyInstance) {
  void app.register(rateLimitPlugin, {
    max: 10,
    timeWindow: '15 minutes',
  });

  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = LoginBody.safeParse(request.body);
    if (!result.success) return reply.status(400).send({ error: 'Invalid request body' });

    const { username, password } = result.data;
    const user = await findUserByUsername(username);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const accessToken = createAccessToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    reply.setCookie(COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && request.headers['x-forwarded-proto'] === 'https',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    // refreshToken also returned in body for mobile clients (stored in SecureStore)
    return { accessToken, refreshToken };
  });

  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { refreshToken?: string } | null;
    const token = request.cookies[COOKIE] ?? body?.refreshToken;
    if (!token) return reply.status(401).send({ error: 'No refresh token' });

    const userId = await validateRefreshToken(token);
    if (!userId) {
      request.log.warn({ tokenPrefix: token.slice(0, 8) }, 'refresh rejected: token not found or expired');
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    return { accessToken: createAccessToken(userId) };
  });

  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { refreshToken?: string } | null;
    const token = request.cookies[COOKIE] ?? body?.refreshToken;
    if (token) await deleteRefreshToken(token);
    reply.clearCookie(COOKIE, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && request.headers['x-forwarded-proto'] === 'https',
      sameSite: 'strict',
    });
    return reply.status(204).send();
  });
}
