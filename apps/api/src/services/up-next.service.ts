import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { batchApplyImageOverrides } from './image-overrides.service';

export interface UpNextItem {
  showTmdbId: number;
  showTitle: string;
  posterPath: string | null;
  backdropPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeId: number;
  episodeTitle: string | null;
  airDate: string | null;
  watchedCount: number;
  totalAired: number;
}

// Shows in watchlist or rewatch, excluding dropped
const TRACKED_SHOWS = `(
  SELECT li.media_id FROM list_items li
  JOIN lists l ON l.id = li.list_id
  WHERE l.user_id = ? AND l.list_type IN ('watchlist', 'rewatch') AND li.media_type = 'show'
  AND li.media_id NOT IN (
    SELECT li2.media_id FROM list_items li2
    JOIN lists l2 ON l2.id = li2.list_id
    WHERE l2.user_id = ? AND l2.list_type = 'dropped' AND li2.media_type = 'show'
  )
)`;

export async function getUpNext(userId: number): Promise<UpNextItem[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       show_id,
       showTmdbId,
       showTitle,
       posterPath,
       backdropPath,
       seasonNumber,
       episodeNumber,
       episodeId,
       episodeTitle,
       airDate
     FROM (
       SELECT
         s.id AS show_id,
         s.tmdb_id  AS showTmdbId,
         s.title    AS showTitle,
         s.poster_path AS posterPath,
         s.backdrop_path AS backdropPath,
         seas.season_number AS seasonNumber,
         e.episode_number AS episodeNumber,
         e.id       AS episodeId,
         e.title    AS episodeTitle,
         e.air_date AS airDate,
         ROW_NUMBER() OVER (
           PARTITION BY s.id
           ORDER BY
             CASE WHEN seas.season_number > last_watched.season_number THEN 0
                  WHEN seas.season_number = last_watched.season_number AND e.episode_number > last_watched.episode_number THEN 0
                  ELSE 1 END,
             seas.season_number,
             e.episode_number
         ) AS rn
       FROM tv_shows s
       JOIN ${TRACKED_SHOWS} tracked ON tracked.media_id = s.id
       JOIN seasons seas ON seas.show_id = s.id AND seas.season_number > 0 AND (seas.season_type IS NULL OR seas.season_type != 'special')
       JOIN episodes e   ON e.season_id  = seas.id
       LEFT JOIN (
         SELECT li.media_id AS show_id, li.added_at AS rewatch_start
         FROM list_items li
         JOIN lists l ON l.id = li.list_id
         WHERE l.user_id = ? AND l.list_type = 'rewatch' AND li.media_type = 'show'
       ) rw_info ON rw_info.show_id = s.id
       -- Only join watch history entries that count for this context:
       -- rewatch shows: only entries after rewatch_start; non-rewatch shows: all entries.
       LEFT JOIN watch_history wh
         ON wh.media_type = 'episode' AND wh.media_id = e.id AND wh.user_id = ?
         AND (rw_info.rewatch_start IS NULL OR wh.watched_at > rw_info.rewatch_start)
       LEFT JOIN (
         SELECT seas2.show_id,
                seas2.season_number,
                e2.episode_number,
                ROW_NUMBER() OVER (PARTITION BY seas2.show_id ORDER BY wh2.watched_at DESC) AS rn2
         FROM watch_history wh2
         JOIN episodes e2   ON e2.id = wh2.media_id
         JOIN seasons seas2 ON seas2.id = e2.season_id AND seas2.season_number > 0 AND (seas2.season_type IS NULL OR seas2.season_type != 'special')
         LEFT JOIN (
           SELECT li.media_id AS show_id, li.added_at AS rewatch_start
           FROM list_items li
           JOIN lists l ON l.id = li.list_id
           WHERE l.user_id = ? AND l.list_type = 'rewatch' AND li.media_type = 'show'
         ) rw ON rw.show_id = seas2.show_id
         WHERE wh2.media_type = 'episode' AND wh2.user_id = ?
         AND (rw.rewatch_start IS NULL OR wh2.watched_at > rw.rewatch_start)
       ) last_watched ON last_watched.show_id = s.id AND last_watched.rn2 = 1
       WHERE wh.id IS NULL
       AND (last_watched.show_id IS NOT NULL OR rw_info.show_id IS NOT NULL)
     ) sub
     WHERE rn = 1
     ORDER BY showTitle
     LIMIT 20`,
    [userId, userId, userId, userId, userId, userId],
  );

  const showIds = rows.map(r => (r as any).show_id);
  if (showIds.length === 0) {
    return rows.map(r => ({ ...(r as UpNextItem), watchedCount: 0, totalAired: 0 }));
  }

  const [counts] = await pool.query<RowDataPacket[]>(
    `SELECT
       s.id,
       COUNT(DISTINCT CASE WHEN wh.id IS NOT NULL THEN wh.media_id END) AS watchedCount,
       COUNT(DISTINCT e.id) AS totalAired
     FROM tv_shows s
     LEFT JOIN seasons seas ON seas.show_id = s.id AND seas.season_number > 0 AND (seas.season_type IS NULL OR seas.season_type != 'special')
     LEFT JOIN episodes e ON e.season_id = seas.id AND e.air_date <= CURDATE()
     LEFT JOIN watch_history wh ON wh.media_type = 'episode' AND wh.media_id = e.id AND wh.user_id = ?
     WHERE s.id IN (${showIds.map(() => '?').join(',')})
     GROUP BY s.id`,
    [userId, ...showIds],
  );

  const countMap = new Map(counts.map(c => [(c as any).id, { watchedCount: (c as any).watchedCount, totalAired: (c as any).totalAired }]));

  const overrides = await batchApplyImageOverrides(
    rows.map(r => ({ mediaType: 'show' as const, tmdbId: (r as any).showTmdbId })),
  );

  return rows.map(row => {
    const ovr = overrides.get(`show:${(row as any).showTmdbId}`) ?? {};
    return {
      ...(row as UpNextItem),
      posterPath: ovr.posterPath ?? (row as any).posterPath,
      backdropPath: ovr.backdropPath ?? (row as any).backdropPath,
      watchedCount: countMap.get((row as any).show_id)?.watchedCount ?? 0,
      totalAired: countMap.get((row as any).show_id)?.totalAired ?? 0,
    };
  });
}
