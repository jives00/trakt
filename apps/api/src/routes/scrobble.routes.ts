import { FastifyInstance, FastifyRequest } from 'fastify';
import { EmbyWebhookPayload } from '@trakt/types';
import { authenticateScrobble, authenticate, scrobbleClientIp } from '../middleware/auth';
import { handleEmbyScrobble, getNowPlaying } from '../services/scrobble.service';
import { handleNuvioScrobble, type NuvioScrobblePayload } from '../services/nuvio-scrobble.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

function describeNuvio(body: any): string {
  if (body?.movie) return body.movie.title ?? '?';
  const ep = body?.episode ? ` S${body.episode.season}E${body.episode.number}` : '';
  return `${body?.show?.title ?? '?'}${ep}`;
}

// Emby also sends test, pause and library events; only these two are scrobbles.
const HANDLED_EMBY_EVENTS = new Set(['playback.start', 'playback.stop']);

function describeEmby(body: any): string {
  const item = body?.Item;
  if (!item) return '(no item)';
  const ep = item.Type === 'Episode' ? ` S${item.ParentIndexNumber}E${item.IndexNumber}` : '';
  const pos = body?.PlaybackInfo?.PositionTicks;
  const pct = pos != null && item.RunTimeTicks > 0 ? ` @ ${Math.round((pos / item.RunTimeTicks) * 100)}%` : '';
  const client = body?.Session?.Client ? ` [${body.Session.Client}]` : '';
  return `${item.SeriesName ?? item.Name ?? '?'}${ep}${pct}${client}`;
}

export async function scrobbleRoutes(app: FastifyInstance) {
  app.post<{ Body: EmbyWebhookPayload }>('/scrobble/emby', { preHandler: authenticateScrobble }, async (request, reply) => {
    try {
      const body = request.body as any;
      console.log(`🎬 Emby ${body?.Event ?? '(no event)'} — ${describeEmby(body)}`);
      if (!HANDLED_EMBY_EVENTS.has(body?.Event)) return reply.send({});

      const parsed = EmbyWebhookPayload.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid payload' });
      }

      await handleEmbyScrobble(parsed.data);
      return reply.send({});
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post<{ Body: NuvioScrobblePayload }>('/scrobble/nuvio/start', { preHandler: authenticateScrobble }, async (request, reply) => {
    try {
      const body = request.body as any;
      console.log(`📺 Nuvio start — ${describeNuvio(body)} @ ${body?.progress ?? 0}% [${scrobbleClientIp(request)} v${body?.app_version ?? '?'}]`);
      await handleNuvioScrobble('start', request.body);
      return reply.send({});
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post<{ Body: NuvioScrobblePayload }>('/scrobble/nuvio/stop', { preHandler: authenticateScrobble }, async (request, reply) => {
    try {
      const body = request.body as any;
      console.log(`⏹️  Nuvio stop  — ${describeNuvio(body)} @ ${body?.progress ?? 0}% [${scrobbleClientIp(request)} v${body?.app_version ?? '?'}]`);
      await handleNuvioScrobble('stop', request.body);
      return reply.send({});
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/scrobble/now-playing', { preHandler: authenticate, logLevel: 'silent' }, async (request, reply) => {
    try {
      const item = await getNowPlaying(userId(request));
      if (!item) {
        return reply.status(204).send();
      }
      return reply.send(item);
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
