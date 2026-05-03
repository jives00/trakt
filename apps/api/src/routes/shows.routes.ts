import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { getOrFetchShow, getOrFetchSeason, getOrFetchEpisode, prefetchAllSeasons, getOrFetchCast, getShowUpNext, getShowRecentEpisodes, getShowSeasonList } from '../services/shows.service';
import {
  getShowStatus, toggleWatchlist, toggleCollection,
  markEpisodeWatched, unmarkEpisodeWatched, getWatchedEpisodeIds,
  markShowWatched, unmarkShowWatched,
} from '../services/user-media.service';
import { getAvailableImages, setImageOverride } from '../services/image-overrides.service';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

function params(request: FastifyRequest) {
  return request.params as Record<string, string>;
}

export async function showsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/shows/:tmdbId', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number(params(request).tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return reply.status(400).send({ error: 'Invalid tmdbId' });
    const show = await getOrFetchShow(tmdbId);
    const status = await getShowStatus(userId(request), show.id);
    return { show, status };
  });

  app.get('/shows/:tmdbId/seasons', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number(params(request).tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return reply.status(400).send({ error: 'Invalid tmdbId' });
    const seasons = await getShowSeasonList(tmdbId);
    return { seasons };
  });

  app.get('/shows/:tmdbId/seasons/:season', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number(params(request).tmdbId);
    const seasonNumber = Number(params(request).season);
    if (!tmdbId || !seasonNumber) return reply.status(400).send({ error: 'Invalid params' });

    const { episodes, showId } = await getOrFetchSeason(tmdbId, seasonNumber);
    const uid = userId(request);
    const watchedEpisodeIds = await getWatchedEpisodeIds(uid, showId);

    return {
      episodes: episodes.map((e) => ({
        id: e.id,
        episodeNumber: e.episode_number,
        title: e.title,
        overview: e.overview,
        airDate: e.air_date,
        stillPath: e.still_path,
        runtimeMin: e.runtime_min,
      })),
      watchedEpisodeIds,
    };
  });

  app.post('/shows/:tmdbId/seasons/:season/episodes/:ep/watched', auth, async (request: FastifyRequest) => {
    const { tmdbId, season, ep } = params(request);
    const { episodeId } = await getOrFetchEpisode(Number(tmdbId), Number(season), Number(ep));
    await markEpisodeWatched(userId(request), episodeId);
    return { watched: true, episodeId };
  });

  app.delete('/shows/:tmdbId/seasons/:season/episodes/:ep/watched', auth, async (request: FastifyRequest) => {
    const { tmdbId, season, ep } = params(request);
    const { episodeId } = await getOrFetchEpisode(Number(tmdbId), Number(season), Number(ep));
    await unmarkEpisodeWatched(userId(request), episodeId);
    return { watched: false, episodeId };
  });

  app.post('/shows/:tmdbId/watched', auth, async (request: FastifyRequest) => {
    const show = await getOrFetchShow(Number(params(request).tmdbId));
    await markShowWatched(userId(request), show.id);
    return { watched: true };
  });

  app.delete('/shows/:tmdbId/watched', auth, async (request: FastifyRequest) => {
    const show = await getOrFetchShow(Number(params(request).tmdbId));
    await unmarkShowWatched(userId(request), show.id);
    return { watched: false };
  });

  app.post('/shows/:tmdbId/watchlist', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    const show = await getOrFetchShow(tmdbId);
    const added = await toggleWatchlist(userId(request), 'show', show.id);
    if (added) void prefetchAllSeasons(tmdbId).catch(() => {});
    return { inWatchlist: added };
  });

  app.delete('/shows/:tmdbId/watchlist', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    const show = await getOrFetchShow(tmdbId);
    const added = await toggleWatchlist(userId(request), 'show', show.id);
    return { inWatchlist: added };
  });

  app.post('/shows/:tmdbId/collection', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    const show = await getOrFetchShow(tmdbId);
    const added = await toggleCollection(userId(request), 'show', show.id);
    return { inCollection: added };
  });

  app.delete('/shows/:tmdbId/collection', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    const show = await getOrFetchShow(tmdbId);
    const added = await toggleCollection(userId(request), 'show', show.id);
    return { inCollection: added };
  });

  app.get('/shows/:tmdbId/cast', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    const cast = await getOrFetchCast(tmdbId);
    return { cast };
  });

  app.get('/shows/:tmdbId/up-next', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    const episode = await getShowUpNext(userId(request), tmdbId);
    return { episode };
  });

  app.get('/shows/:tmdbId/recent-episodes', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    const episodes = await getShowRecentEpisodes(tmdbId, 2);
    return { episodes };
  });

  app.get('/shows/:tmdbId/images', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number(params(request).tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return reply.status(400).send({ error: 'Invalid tmdbId' });
    const images = await getAvailableImages('show', tmdbId);
    return images;
  });

  app.put('/shows/:tmdbId/image', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number(params(request).tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return reply.status(400).send({ error: 'Invalid tmdbId' });
    const { imageType, path } = request.body as { imageType: 'hero' | 'poster'; path: string };
    if (!['hero', 'poster'].includes(imageType) || !path) return reply.status(400).send({ error: 'Invalid body' });
    await setImageOverride('show', tmdbId, imageType, path);
    return { ok: true };
  });
}
