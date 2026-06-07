import Fastify, { FastifyInstance } from 'fastify';
import cookiePlugin from '@fastify/cookie';
import corsPlugin from '@fastify/cors';
import helmetPlugin from '@fastify/helmet';
import jwtPlugin from '@fastify/jwt';
import { healthRoutes } from './routes/health.routes';
import { authRoutes } from './routes/auth.routes';
import { searchRoutes } from './routes/search.routes';
import { moviesRoutes } from './routes/movies.routes';
import { showsRoutes } from './routes/shows.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { historyRoutes } from './routes/history.routes';
import { progressRoutes } from './routes/progress.routes';
import { listsRoutes } from './routes/lists.routes';
import { ratingsRoutes } from './routes/ratings.routes';
import { statsRoutes } from './routes/stats.routes';
import { userRoutes } from './routes/user.routes';
import { exclusionsRoutes } from './routes/exclusions.routes';
import { scrobbleRoutes } from './routes/scrobble.routes';
import { stremioAddonRoutes } from './routes/stremio-addon.routes';
import { nuvioAddonRoutes } from './routes/nuvio-addon.routes';
import { settingsRoutes } from './routes/settings.routes';
import { discoverRoutes } from './routes/discover.routes';
import { exportTokenRoutes } from './routes/export-token.routes';
import { exportFeedsRoutes } from './routes/export-feeds.routes';
import { excelExportRoutes } from './routes/excel-export.routes';
import { appVersionRoutes } from './routes/app-version.routes';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } },
    trustProxy: true,
  });

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

  void app.register(healthRoutes);
  void app.register(authRoutes, { prefix: '/api/auth' });
  void app.register(searchRoutes, { prefix: '/api' });
  void app.register(moviesRoutes, { prefix: '/api' });
  void app.register(showsRoutes, { prefix: '/api' });
  void app.register(dashboardRoutes, { prefix: '/api' });
  void app.register(historyRoutes, { prefix: '/api' });
  void app.register(progressRoutes, { prefix: '/api' });
  void app.register(listsRoutes, { prefix: '/api' });
  void app.register(ratingsRoutes, { prefix: '/api' });
  void app.register(statsRoutes, { prefix: '/api' });
  void app.register(userRoutes, { prefix: '/api' });
  void app.register(exclusionsRoutes, { prefix: '/api' });
  void app.register(scrobbleRoutes, { prefix: '/api' });
  void app.register(settingsRoutes, { prefix: '/api' });
  void app.register(discoverRoutes, { prefix: '/api' });
  void app.register(exportTokenRoutes, { prefix: '/api' });
  void app.register(exportFeedsRoutes, { prefix: '/api' });
  void app.register(excelExportRoutes, { prefix: '/api' });
  void app.register(appVersionRoutes, { prefix: '/api' });
  void app.register(stremioAddonRoutes, { prefix: '/stremio-addon' });
  void app.register(nuvioAddonRoutes, { prefix: '/nuvio-addon' });

  return app;
}
