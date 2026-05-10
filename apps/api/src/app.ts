import Fastify, { FastifyInstance } from 'fastify';
import cookiePlugin from '@fastify/cookie';
import corsPlugin from '@fastify/cors';
import helmetPlugin from '@fastify/helmet';
import jwtPlugin from '@fastify/jwt';
import { authRoutes } from './routes/auth.routes';
import { searchRoutes } from './routes/search.routes';
import { moviesRoutes } from './routes/movies.routes';
import { showsRoutes } from './routes/shows.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { historyRoutes } from './routes/history.routes';
import { progressRoutes } from './routes/progress.routes';
import { collectionRoutes } from './routes/collection.routes';
import { watchlistRoutes } from './routes/watchlist.routes';
import { listsRoutes } from './routes/lists.routes';
import { ratingsRoutes } from './routes/ratings.routes';
import { statsRoutes } from './routes/stats.routes';
import { userRoutes } from './routes/user.routes';
import { exclusionsRoutes } from './routes/exclusions.routes';
import { scrobbleRoutes } from './routes/scrobble.routes';
import { stremioAddonRoutes } from './routes/stremio-addon.routes';
import { settingsRoutes } from './routes/settings.routes';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: true });

  void app.register(helmetPlugin, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  void app.register(corsPlugin, {
    origin: true, // Allow all origins; sensitive endpoints are JWT-protected
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
  void app.register(historyRoutes, { prefix: '/api' });
  void app.register(progressRoutes, { prefix: '/api' });
  void app.register(collectionRoutes, { prefix: '/api' });
  void app.register(watchlistRoutes, { prefix: '/api' });
  void app.register(listsRoutes, { prefix: '/api' });
  void app.register(ratingsRoutes, { prefix: '/api' });
  void app.register(statsRoutes, { prefix: '/api' });
  void app.register(userRoutes, { prefix: '/api' });
  void app.register(exclusionsRoutes, { prefix: '/api' });
  void app.register(scrobbleRoutes, { prefix: '/api' });
  void app.register(settingsRoutes, { prefix: '/api' });
  void app.register(stremioAddonRoutes, { prefix: '/stremio-addon' });

  return app;
}
