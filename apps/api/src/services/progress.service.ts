import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { ProgressItem } from '@trakt/types';

const AIRING_STATUSES = ['Returning Series', 'In Production', 'Pilot'];
const ENDED_STATUSES = ['Ended', 'Canceled', 'Cancelled'];

type ShowRow = ProgressItem & { showId: number };

export async function getProgress(
  userId: number,
  status: 'airing' | 'ended' | 'all',
): Promise<ProgressItem[]> {
  const pool = getPool();

  const [showRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       ts.id AS showId, ts.tmdb_id AS tmdbId, ts.title,
       ts.poster_path AS posterPath, ts.status, ts.network,
       COUNT(DISTINCT e.id) AS totalEpisodes,
       COUNT(DISTINCT wh.media_id) AS watchedEpisodes,
       COUNT(DISTINCT seas.id) AS totalSeasons,
       MAX(wh.watched_at) AS lastWatchedAt
     FROM tv_shows ts
     JOIN (
       SELECT DISTINCT e2.show_id
       FROM watch_history wh2
       JOIN episodes e2 ON e2.id = wh2.media_id
       WHERE wh2.user_id = ? AND wh2.media_type = 'episode'
     ) watched_shows ON watched_shows.show_id = ts.id
     JOIN seasons seas ON seas.show_id = ts.id AND seas.season_number > 0
     JOIN episodes e ON e.season_id = seas.id
       AND (e.air_date IS NULL OR e.air_date <= CURDATE())
     LEFT JOIN watch_history wh
       ON wh.media_type = 'episode' AND wh.media_id = e.id AND wh.user_id = ?
     GROUP BY ts.id
     HAVING watchedEpisodes > 0 AND watchedEpisodes < totalEpisodes
     ORDER BY lastWatchedAt DESC`,
    [userId, userId],
  );

  let shows = showRows as ShowRow[];

  if (status === 'airing') {
    shows = shows.filter((s) => AIRING_STATUSES.includes(s.status ?? ''));
  } else if (status === 'ended') {
    shows = shows.filter((s) => ENDED_STATUSES.includes(s.status ?? ''));
  }

  if (shows.length === 0) return [];

  const showIds = shows.map((s) => s.showId);
  const placeholders = showIds.map(() => '?').join(', ');

  const [nextEpRows] = await pool.query<RowDataPacket[]>(
    `SELECT sub.showId, sub.seasonNumber, sub.episodeNumber, sub.episodeTitle
     FROM (
       SELECT
         ts.id AS showId,
         seas.season_number AS seasonNumber,
         e.episode_number AS episodeNumber,
         e.title AS episodeTitle,
         ROW_NUMBER() OVER (
           PARTITION BY ts.id ORDER BY seas.season_number, e.episode_number
         ) AS rn
       FROM tv_shows ts
       JOIN seasons seas ON seas.show_id = ts.id AND seas.season_number > 0
       JOIN episodes e ON e.season_id = seas.id
       LEFT JOIN watch_history wh
         ON wh.media_type = 'episode' AND wh.media_id = e.id AND wh.user_id = ?
       WHERE wh.id IS NULL AND ts.id IN (${placeholders})
     ) sub
     WHERE rn = 1`,
    [userId, ...showIds],
  );

  const nextEpMap = new Map<number, ProgressItem['nextEpisode']>(
    (nextEpRows as RowDataPacket[]).map((r) => [
      r.showId as number,
      {
        seasonNumber: r.seasonNumber as number,
        episodeNumber: r.episodeNumber as number,
        title: r.episodeTitle as string | null,
      },
    ]),
  );

  return shows.map((s) => ({
    ...s,
    totalEpisodes: Number(s.totalEpisodes),
    watchedEpisodes: Number(s.watchedEpisodes),
    totalSeasons: Number(s.totalSeasons),
    nextEpisode: nextEpMap.get(s.showId) ?? null,
  }));
}
