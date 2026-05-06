import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getTraktToken, setTraktToken } from '../services/trakt-poll.service';
import { initiateDeviceCodeFlow, checkAuthorizationStatus } from '../services/trakt-oauth.service';

export async function settingsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/settings/api-key', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = process.env.SCROBBLE_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ error: 'API key not configured' });
    }
    return reply.send({ scrobbleApiKey: apiKey });
  });

  app.get('/settings/trakt-auth', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const token = await getTraktToken();
    const isConnected = token && new Date(token.expiresAt) > new Date();
    return reply.send({ isConnected });
  });

  app.post<{ Body: { accessToken?: string; refreshToken?: string; expiresAt?: string } }>(
    '/settings/trakt-auth',
    auth,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { accessToken, refreshToken, expiresAt } = request.body;

      if (!accessToken || !refreshToken || !expiresAt) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      try {
        await setTraktToken({
          accessToken,
          refreshToken,
          expiresAt: new Date(expiresAt),
        });
        return reply.status(201).send({ isConnected: true });
      } catch (err) {
        return reply.status(500).send({ error: 'Failed to store token' });
      }
    }
  );

  // Start device code OAuth flow
  app.post('/settings/trakt-auth/start', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userCode, expiresIn } = await initiateDeviceCodeFlow();
      return reply.status(200).send({ userCode, expiresIn, verificationUrl: 'https://trakt.tv/activate' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to initiate device code flow:', message);
      return reply.status(500).send({ error: message });
    }
  });

  // Check device code authorization status
  app.post('/settings/trakt-auth/check', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await checkAuthorizationStatus();
      return reply.send(status);
    } catch (err) {
      console.error('Failed to check authorization:', err);
      return reply.status(500).send({ error: 'Failed to check authorization status' });
    }
  });
}
