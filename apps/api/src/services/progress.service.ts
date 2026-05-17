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
       MAX(wh.watched_at) AS lastWatchedAt,
       rewatch.added_at AS rewatchStartDate
     FROM tv_shows ts
     JOIN (
       SELECT DISTINCT e2.show_id
       FROM watch_history wh2
       JOIN episodes e2 ON e2.id = wh2.media_id
       WHERE wh2.user_id = ? AND wh2.media_type = 'episode'
     ) watched_shows ON watched_shows.show_id = ts.id
     JOIN seasons seas ON seas.show_id = ts.id AND seas.season_number > 0 AND (seas.season_type IS NULL OR seas.season_type != 'special')
     JOIN episodes e ON e.season_id = seas.id
       AND e.air_date IS NOT NULL AND e.air_date <= CURDATE()
     LEFT JOIN watch_history wh
       ON wh.media_type = 'episode' AND wh.media_id = e.id AND wh.user_id = ?
     LEFT JOIN (
       SELECT li.media_id FROM list_items li
       JOIN lists l ON l.id = li.list_id
       WHERE li.media_type = 'show' AND l.list_type = 'dropped' AND l.user_id = ?
     ) dropped_shows ON dropped_shows.media_id = ts.id
     LEFT JOIN (
       SELECT li.media_id, MIN(li.added_at) as added_at FROM list_items li
       JOIN lists l ON l.id = li.list_id
       WHERE li.media_type = 'show' AND l.list_type = 'rewatch' AND l.user_id = ?
       GROUP BY li.media_id
     ) rewatch ON rewatch.media_id = ts.id
     WHERE dropped_shows.media_id IS NULL
     GROUP BY ts.id
     HAVING watchedEpisodes > 0 AND (watchedEpisodes < totalEpisodes OR rewatchStartDate IS NOT NULL)
     ORDER BY lastWatchedAt DESC`,
    [userId, userId, userId, userId],
  );

  let shows = showRows as ShowRow[];

  // For rewatch shows, filter watched episodes to only count those after rewatch started
  const rewatchMap = new Map<number, Date>();
  if (shows.length > 0) {
    const [rewatchDates] = await pool.query<RowDataPacket[]>(
      `SELECT li.media_id, MIN(li.added_at) as added_at FROM list_items li
       JOIN lists l ON l.id = li.list_id
       WHERE li.media_type = 'show' AND l.list_type = 'rewatch' AND l.user_id = ? AND li.media_id IN (${shows.map(() => '?').join(',')})
       GROUP BY li.media_id`,
      [userId, ...shows.map(s => s.showId)],
    );

    rewatchDates.forEach((r: any) => rewatchMap.set(r.media_id, r.added_at));

    // Batch-fetch recent episode counts for all rewatch shows in a single query
    if (rewatchMap.size > 0) {
      const rewatchIds = Array.from(rewatchMap.keys());
      const [recentWatchRows] = await pool.query<RowDataPacket[]>(
        `SELECT e.show_id, COUNT(DISTINCT wh.media_id) as count
         FROM watch_history wh
         JOIN episodes e ON e.id = wh.media_id
         WHERE wh.user_id = ? AND e.show_id IN (${rewatchIds.map(() => '?').join(',')})
           AND wh.watched_at >= (
             SELECT MIN(li2.added_at) FROM list_items li2
             JOIN lists l2 ON l2.id = li2.list_id
             WHERE li2.media_type = 'show' AND l2.list_type = 'rewatch' AND l2.user_id = ? AND li2.media_id = e.show_id
           )
         GROUP BY e.show_id`,
        [userId, ...rewatchIds, userId],
      );
      const recentCountMap = new Map<number, number>(
        recentWatchRows.map((r: any) => [r.show_id, Number(r.count)]),
      );
      for (const show of shows) {
        if (rewatchMap.has(show.showId)) {
          show.watchedEpisodes = recentCountMap.get(show.showId) ?? 0;
        }
      }
    }
  }

  if (status === 'airing') {
    shows = shows.filter((s) => AIRING_STATUSES.includes(s.status ?? ''));
  } else if (status === 'ended') {
    shows = shows.filter((s) => ENDED_STATUSES.includes(s.status ?? ''));
  }

  if (shows.length === 0) return [];

  const nextEpMap = new Map<number, ProgressItem['nextEpisode']>();

  // Split shows into those with and without a rewatch cutoff date.
  // Each group is resolved with two batch queries instead of 2×N individual queries.
  const nonRewatchShows = shows.filter((s) => !rewatchMap.has(s.showId));
  const rewatchShows = shows.filter((s) => rewatchMap.has(s.showId));

  // --- Non-rewatch shows ---
  if (nonRewatchShows.length > 0) {
    const ids = nonRewatchShows.map((s) => s.showId);
    const inList = ids.map(() => '?').join(',');

    // Batch 1: last-watched episode per show (no cutoff)
    const [lastWatchedRows] = await pool.query<RowDataPacket[]>(
      `SELECT show_id, season_number, episode_number FROM (
         SELECT e.show_id, seas.season_number, e.episode_number,
           ROW_NUMBER() OVER (PARTITION BY e.show_id ORDER BY wh.watched_at DESC) AS rn
         FROM watch_history wh
         JOIN episodes e ON e.id = wh.media_id
         JOIN seasons seas ON seas.id = e.season_id
         WHERE wh.media_type = 'episode' AND wh.user_id = ? AND e.show_id IN (${inList})
       ) t WHERE rn = 1`,
      [userId, ...ids],
    );
    const lastWatchedMap = new Map(
      (lastWatchedRows as any[]).map((r) => [r.show_id as number, { lastSeason: r.season_number as number, lastEp: r.episode_number as number }]),
    );

    // Batch 2: next unwatched episode per show
    const lwEntries = nonRewatchShows.map((s) => ({
      showId: s.showId,
      lastSeason: lastWatchedMap.get(s.showId)?.lastSeason ?? 0,
      lastEp: lastWatchedMap.get(s.showId)?.lastEp ?? 0,
    }));
    const lwUnion = lwEntries.map(() => 'SELECT ? AS sid, ? AS ls, ? AS le').join(' UNION ALL ');
    const lwParams = lwEntries.flatMap((e) => [e.showId, e.lastSeason, e.lastEp]);

    const [nextEpRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM (
         SELECT e.show_id AS showId, seas.season_number AS seasonNumber,
           e.episode_number AS episodeNumber, e.title AS episodeTitle,
           ROW_NUMBER() OVER (PARTITION BY e.show_id ORDER BY seas.season_number, e.episode_number) AS rn
         FROM episodes e
         JOIN seasons seas ON seas.id = e.season_id AND seas.season_number > 0
         JOIN (${lwUnion}) lw ON lw.sid = e.show_id
           AND (seas.season_number > lw.ls OR (seas.season_number = lw.ls AND e.episode_number > lw.le))
         LEFT JOIN watch_history wh_check
           ON wh_check.media_type = 'episode' AND wh_check.media_id = e.id AND wh_check.user_id = ?
         WHERE e.air_date IS NOT NULL AND e.air_date <= CURDATE()
           AND wh_check.id IS NULL
       ) ranked WHERE rn = 1`,
      [...lwParams, userId],
    );

    for (const r of nextEpRows as any[]) {
      nextEpMap.set(r.showId, { seasonNumber: r.seasonNumber, episodeNumber: r.episodeNumber, title: r.episodeTitle ?? null });
    }
  }

  // --- Rewatch shows (per-show cutoff date, usually a small set) ---
  if (rewatchShows.length > 0) {
    const rwEntries = rewatchShows.map((s) => ({ showId: s.showId, cutoff: rewatchMap.get(s.showId)! }));

    // Batch 3: last-watched episode per rewatch show (with per-show cutoff)
    const rwUnion = rwEntries.map(() => 'SELECT ? AS sid, ? AS cutoff').join(' UNION ALL ');
    const rwParams = rwEntries.flatMap((e) => [e.showId, e.cutoff]);

    const [lastWatchedRwRows] = await pool.query<RowDataPacket[]>(
      `SELECT show_id, season_number, episode_number FROM (
         SELECT e.show_id, seas.season_number, e.episode_number,
           ROW_NUMBER() OVER (PARTITION BY e.show_id ORDER BY wh.watched_at DESC) AS rn
         FROM watch_history wh
         JOIN episodes e ON e.id = wh.media_id
         JOIN seasons seas ON seas.id = e.season_id
         JOIN (${rwUnion}) rw ON rw.sid = e.show_id AND wh.watched_at >= rw.cutoff
         WHERE wh.media_type = 'episode' AND wh.user_id = ?
       ) t WHERE rn = 1`,
      [...rwParams, userId],
    );
    const lastWatchedRwMap = new Map(
      (lastWatchedRwRows as any[]).map((r) => [r.show_id as number, { lastSeason: r.season_number as number, lastEp: r.episode_number as number }]),
    );

    // Batch 4: next unwatched episode per rewatch show (respecting per-show cutoff via LEFT JOIN)
    const lwRwEntries = rewatchShows.map((s) => ({
      showId: s.showId,
      lastSeason: lastWatchedRwMap.get(s.showId)?.lastSeason ?? 0,
      lastEp: lastWatchedRwMap.get(s.showId)?.lastEp ?? 0,
      cutoff: rewatchMap.get(s.showId)!,
    }));
    const lwRwUnion = lwRwEntries.map(() => 'SELECT ? AS sid, ? AS ls, ? AS le, ? AS cutoff').join(' UNION ALL ');
    const lwRwParams = lwRwEntries.flatMap((e) => [e.showId, e.lastSeason, e.lastEp, e.cutoff]);

    const [nextEpRwRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM (
         SELECT e.show_id AS showId, seas.season_number AS seasonNumber,
           e.episode_number AS episodeNumber, e.title AS episodeTitle,
           ROW_NUMBER() OVER (PARTITION BY e.show_id ORDER BY seas.season_number, e.episode_number) AS rn
         FROM episodes e
         JOIN seasons seas ON seas.id = e.season_id AND seas.season_number > 0
         JOIN (${lwRwUnion}) lw ON lw.sid = e.show_id
           AND (seas.season_number > lw.ls OR (seas.season_number = lw.ls AND e.episode_number > lw.le))
         LEFT JOIN watch_history wh_check
           ON wh_check.media_type = 'episode' AND wh_check.media_id = e.id
           AND wh_check.user_id = ? AND wh_check.watched_at >= lw.cutoff
         WHERE e.air_date IS NOT NULL AND e.air_date <= CURDATE()
           AND wh_check.id IS NULL
       ) ranked WHERE rn = 1`,
      [...lwRwParams, userId],
    );

    for (const r of nextEpRwRows as any[]) {
      nextEpMap.set(r.showId, { seasonNumber: r.seasonNumber, episodeNumber: r.episodeNumber, title: r.episodeTitle ?? null });
    }
  }

  return shows.map((s) => ({
    ...s,
    totalEpisodes: Number(s.totalEpisodes),
    watchedEpisodes: Number(s.watchedEpisodes),
    totalSeasons: Number(s.totalSeasons),
    nextEpisode: nextEpMap.get(s.showId) ?? null,
  }));
}
