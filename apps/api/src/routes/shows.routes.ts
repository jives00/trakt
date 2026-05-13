import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RowDataPacket } from 'mysql2/promise';
import { authenticate } from '../middleware/auth';
import { getOrFetchShow, getOrFetchSeason, getOrFetchEpisode, prefetchAllSeasons, getOrFetchCast, forceRefreshShowCast, forceRefreshShowMetadata, forceRefreshShowSeasons, forceRefreshEpisode, getShowUpNext, getShowRecentEpisodes, getShowSeasonList, getEpisodeDetail, getEpisodeCast } from '../services/shows.service';
import {
  getShowStatus, toggleWatchlist, removeFromWatchlist, toggleDropped, toggleRewatch,
  markEpisodeWatched, unmarkEpisodeWatched, getWatchedEpisodeIds,
  markShowWatched, unmarkShowWatched, checkRewatchCompletion,
} from '../services/user-media.service';
import { getAvailableImages, setImageOverride } from '../services/image-overrides.service';
import { getPool } from '../db';
import { HistoryItem } from '@trakt/types';

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
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !Number.isInteger(seasonNumber) || seasonNumber < 0) return reply.status(400).send({ error: 'Invalid params' });

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
    const { watchedAt } = (request.body as any) ?? {};
    const show = await getOrFetchShow(Number(tmdbId));
    const { episodeId } = await getOrFetchEpisode(Number(tmdbId), Number(season), Number(ep));
    const uid = userId(request);
    await markEpisodeWatched(uid, episodeId, watchedAt);
    void checkRewatchCompletion(uid, show.id).catch(() => {});
    return { watched: true, episodeId };
  });

  app.delete('/shows/:tmdbId/seasons/:season/episodes/:ep/watched', auth, async (request: FastifyRequest) => {
    const { tmdbId, season, ep } = params(request);
    const { episodeId } = await getOrFetchEpisode(Number(tmdbId), Number(season), Number(ep));
    await unmarkEpisodeWatched(userId(request), episodeId);
    return { watched: false, episodeId };
  });

  app.get('/shows/:tmdbId/seasons/:season/episodes/:ep/history', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number(params(request).tmdbId);
    const seasonNumber = Number(params(request).season);
    const episodeNumber = Number(params(request).ep);
    const { episodeId } = await getOrFetchEpisode(tmdbId, seasonNumber, episodeNumber);
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         wh.id, wh.media_type AS mediaType, wh.media_id AS mediaId,
         wh.watched_at AS watchedAt, wh.progress_pct AS progressPct, wh.source,
         ts.tmdb_id AS tmdbId, e.title, ts.poster_path AS posterPath,
         ts.title AS showTitle, seas.season_number AS seasonNumber,
         e.episode_number AS episodeNumber
       FROM watch_history wh
       LEFT JOIN episodes e ON e.id=wh.media_id
       LEFT JOIN seasons seas ON e.season_id=seas.id
       LEFT JOIN tv_shows ts ON e.show_id=ts.id
       WHERE wh.user_id=? AND wh.media_type='episode' AND wh.media_id=?
       ORDER BY wh.watched_at DESC`,
      [userId(request), episodeId],
    );
    return rows as HistoryItem[];
  });

  app.get('/shows/:tmdbId/seasons/:season/episodes/:ep', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number(params(request).tmdbId);
    const seasonNumber = Number(params(request).season);
    const episodeNumber = Number(params(request).ep);
    if (!tmdbId || !seasonNumber || !episodeNumber) return reply.status(400).send({ error: 'Invalid params' });
    const { episode, episodeId, showId } = await getEpisodeDetail(tmdbId, seasonNumber, episodeNumber);
    const uid = userId(request);
    const watchedEpisodeIds = await getWatchedEpisodeIds(uid, showId);
    const watched = watchedEpisodeIds.includes(episodeId);
    return { episode, watched };
  });

  app.get('/shows/:tmdbId/seasons/:season/episodes/:ep/cast', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const tmdbId = Number(params(request).tmdbId);
    const seasonNumber = Number(params(request).season);
    const episodeNumber = Number(params(request).ep);
    if (!tmdbId || !seasonNumber || !episodeNumber) return reply.status(400).send({ error: 'Invalid params' });
    const cast = await getEpisodeCast(tmdbId, seasonNumber, episodeNumber);
    return { cast };
  });

  app.post('/shows/:tmdbId/watched', auth, async (request: FastifyRequest) => {
    const { watchedAt } = (request.body as any) ?? {};
    const show = await getOrFetchShow(Number(params(request).tmdbId));
    await markShowWatched(userId(request), show.id, watchedAt);
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
    await removeFromWatchlist(userId(request), 'show', show.id);
    return { inWatchlist: false };
  });

  app.post('/shows/:tmdbId/dropped', auth, async (request: FastifyRequest) => {
    const show = await getOrFetchShow(Number(params(request).tmdbId));
    const dropped = await toggleDropped(userId(request), show.id);
    return { inDropped: dropped };
  });

  app.post('/shows/:tmdbId/rewatch', auth, async (request: FastifyRequest) => {
    const show = await getOrFetchShow(Number(params(request).tmdbId));
    const rewatching = await toggleRewatch(userId(request), show.id);
    return { inRewatch: rewatching };
  });

  app.get('/shows/:tmdbId/cast', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    const cast = await getOrFetchCast(tmdbId);
    return { cast };
  });

  app.post('/shows/:tmdbId/cast/refresh', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    const cast = await forceRefreshShowCast(tmdbId);
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

  app.post('/shows/:tmdbId/metadata/refresh', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return { error: 'Invalid tmdbId' };
    const show = await forceRefreshShowMetadata(tmdbId);
    return { show };
  });

  app.post('/shows/:tmdbId/seasons/refresh', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return { error: 'Invalid tmdbId' };
    await forceRefreshShowSeasons(tmdbId);
    return { ok: true };
  });

  app.post('/shows/:tmdbId/seasons/:season/episodes/refresh', auth, async (request: FastifyRequest) => {
    const tmdbId = Number(params(request).tmdbId);
    const season = Number(params(request).season);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !Number.isInteger(season)) return { error: 'Invalid params' };
    const { seasonId, showId, episodes } = await forceRefreshEpisode(tmdbId, season);
    return { seasonId, showId, episodes };
  });
}
