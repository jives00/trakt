import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { batchApplyImageOverrides } from './image-overrides.service';

export interface ScheduleEntry {
  mediaType: 'episode' | 'movie';
  showTmdbId?: number;
  showTitle?: string;
  movieTmdbId?: number;
  movieTitle?: string;
  movieTagline?: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  network: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string | null;
  episodeType?: string;
  date: string;
  airTime?: string | null;
}

const TRACKED_SHOWS = `(
  SELECT media_id FROM watchlist WHERE user_id = ? AND media_type = 'show'
  UNION
  SELECT media_id FROM collection WHERE user_id = ? AND media_type = 'show'
)`;

const TRACKED_MOVIES = `(
  SELECT media_id FROM watchlist WHERE user_id = ? AND media_type = 'movie'
  UNION
  SELECT media_id FROM collection WHERE user_id = ? AND media_type = 'movie'
)`;

export async function getSchedule(
  userId: number,
  range = 7,
  type = 'all',
  startDays = 0,
): Promise<ScheduleEntry[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       'episode' AS mediaType,
       s.tmdb_id       AS showTmdbId,
       s.title         AS showTitle,
       NULL            AS movieTmdbId,
       NULL            AS movieTitle,
       NULL            AS movieTagline,
       s.poster_path   AS posterPath,
       s.backdrop_path AS backdropPath,
       s.network,
       seas.season_number AS seasonNumber,
       e.episode_number   AS episodeNumber,
       e.title            AS episodeTitle,
       e.episode_type     AS episodeType,
       e.air_date         AS date,
       e.air_time         AS airTime
     FROM tv_shows s
     JOIN ${TRACKED_SHOWS} tracked ON tracked.media_id = s.id
     JOIN seasons seas ON seas.show_id = s.id
     JOIN episodes e   ON e.season_id  = seas.id
     WHERE e.air_date >= DATE_ADD(CURDATE(), INTERVAL ? DAY) AND e.air_date < DATE_ADD(CURDATE(), INTERVAL ? DAY)
     UNION ALL
     SELECT
       'movie'          AS mediaType,
       NULL             AS showTmdbId,
       NULL             AS showTitle,
       m.tmdb_id        AS movieTmdbId,
       m.title          AS movieTitle,
       m.tagline        AS movieTagline,
       m.poster_path    AS posterPath,
       m.backdrop_path  AS backdropPath,
       NULL             AS network,
       NULL             AS seasonNumber,
       NULL             AS episodeNumber,
       NULL             AS episodeTitle,
       NULL             AS episodeType,
       m.release_date   AS date,
       NULL             AS airTime
     FROM movies m
     JOIN ${TRACKED_MOVIES} tracked_movies ON tracked_movies.media_id = m.id
     WHERE m.release_date >= DATE_ADD(CURDATE(), INTERVAL ? DAY) AND m.release_date < DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY date, showTitle, movieTitle
     LIMIT 100`,
    [userId, userId, startDays, startDays + range, userId, userId, startDays, startDays + range],
  );

  const overridePairs = (rows as ScheduleEntry[]).map(r => ({
    mediaType: (r.mediaType === 'episode' ? 'show' : 'movie') as 'show' | 'movie',
    tmdbId: r.mediaType === 'episode' ? r.showTmdbId! : r.movieTmdbId!,
  }));
  const overrides = await batchApplyImageOverrides(overridePairs);

  return (rows as ScheduleEntry[]).map(r => {
    const mt = r.mediaType === 'episode' ? 'show' : 'movie';
    const id = r.mediaType === 'episode' ? r.showTmdbId! : r.movieTmdbId!;
    const ovr = overrides.get(`${mt}:${id}`) ?? {};
    return { ...r, posterPath: ovr.posterPath ?? r.posterPath, backdropPath: ovr.backdropPath ?? r.backdropPath };
  });
}
