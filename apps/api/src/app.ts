import Fastify, { FastifyInstance } from 'fastify';
import cookiePlugin from '@fastify/cookie';
import corsPlugin from '@fastify/cors';
import jwtPlugin from '@fastify/jwt';
import { authRoutes } from './routes/auth.routes';
import { searchRoutes } from './routes/search.routes';
import { moviesRoutes } from './routes/movies.routes';
import { showsRoutes } from './routes/shows.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { authenticate } from './middleware/auth';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  void app.register(corsPlugin, {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  void app.register(cookiePlugin);
  void app.register(jwtPlugin, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  });

  void app.register(authRoutes, { prefix: '/api/auth' });
  void app.register(searchRoutes, { prefix: '/api' });
  void app.register(moviesRoutes, { prefix: '/api' });
  void app.register(showsRoutes, { prefix: '/api' });
  void app.register(dashboardRoutes, { prefix: '/api' });

  // Phase 0 stub — full implementation in Phase 1
  app.get('/api/history', { preHandler: [authenticate] }, async () => []);

  return app;
}
