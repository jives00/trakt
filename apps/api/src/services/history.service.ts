import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool } from '../db';
import { HistoryItem } from '@trakt/types';

export async function getHistory(
  userId: number,
  type: 'movie' | 'episode' | 'all',
  page: number,
  limit: number,
  date?: string,
  tzOffset = '+00:00',
): Promise<{ items: HistoryItem[]; total: number }> {
  const pool = getPool();
  const offset = (page - 1) * limit;
  const typeWhere = type === 'all' ? '' : ' AND media_type = ?';
  const localDate = `CONVERT_TZ(wh.watched_at, '+00:00', '${tzOffset}')`;
  const dateWhere = date ? ` AND DATE(${localDate}) = ?` : '';
  const typeParam = type === 'all' ? [] : [type];
  const dateParam = date ? [date] : [];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       wh.id, wh.media_type AS mediaType, wh.media_id AS mediaId,
       wh.watched_at AS watchedAt, wh.progress_pct AS progressPct, wh.source,
       COALESCE(m.tmdb_id, ts.tmdb_id) AS tmdbId,
       CASE WHEN wh.media_type='movie' THEN m.title ELSE e.title END AS title,
       CASE WHEN wh.media_type='movie' THEN m.poster_path ELSE ts.poster_path END AS posterPath,
       ts.title AS showTitle,
       seas.season_number AS seasonNumber,
       e.episode_number AS episodeNumber
     FROM watch_history wh
     LEFT JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
     LEFT JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id
     LEFT JOIN seasons seas ON e.season_id=seas.id
     LEFT JOIN tv_shows ts ON e.show_id=ts.id
     WHERE wh.user_id=?${typeWhere}${dateWhere}
       AND (wh.completion_progress >= 90 OR wh.playback_stopped_at IS NOT NULL)
     ORDER BY wh.watched_at DESC
     LIMIT ? OFFSET ?`,
    [userId, ...typeParam, ...dateParam, limit, offset],
  );

  const localDateSimple = `CONVERT_TZ(watched_at, '+00:00', '${tzOffset}')`;
  const dateWhereFull = date ? ` AND DATE(${localDateSimple}) = ?` : '';
  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM watch_history WHERE user_id=?${typeWhere}${dateWhereFull} AND (completion_progress >= 90 OR playback_stopped_at IS NOT NULL)`,
    [userId, ...typeParam, ...dateParam],
  );

  return { items: rows as HistoryItem[], total: countRow.total as number };
}

export async function deleteHistoryEntry(userId: number, id: number): Promise<boolean> {
  const [result] = await getPool().query<ResultSetHeader>(
    'DELETE FROM watch_history WHERE id=? AND user_id=?',
    [id, userId],
  );
  return result.affectedRows > 0;
}
