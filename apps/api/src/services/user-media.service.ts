import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';

type MediaType = 'movie' | 'show';

export async function getMovieStatus(userId: number, movieId: number) {
  const pool = getPool();
  const [[wl], [col], [hist]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      'SELECT id FROM watchlist WHERE user_id=? AND media_type="movie" AND media_id=?', [userId, movieId],
    ),
    pool.query<RowDataPacket[]>(
      'SELECT id FROM collection WHERE user_id=? AND media_type="movie" AND media_id=?', [userId, movieId],
    ),
    pool.query<RowDataPacket[]>(
      'SELECT id FROM watch_history WHERE user_id=? AND media_type="movie" AND media_id=?', [userId, movieId],
    ),
  ]);
  return { inWatchlist: wl.length > 0, inCollection: col.length > 0, watched: hist.length > 0 };
}

export async function getShowStatus(userId: number, showId: number) {
  const pool = getPool();
  const [[wl], [col], [hist]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      'SELECT id FROM watchlist WHERE user_id=? AND media_type="show" AND media_id=?', [userId, showId],
    ),
    pool.query<RowDataPacket[]>(
      'SELECT id FROM collection WHERE user_id=? AND media_type="show" AND media_id=?', [userId, showId],
    ),
    pool.query<RowDataPacket[]>(
      `SELECT wh.id FROM watch_history wh JOIN episodes e ON wh.media_id=e.id
       WHERE wh.user_id=? AND wh.media_type="episode" AND e.show_id=? LIMIT 1`,
      [userId, showId],
    ),
  ]);
  return { inWatchlist: wl.length > 0, inCollection: col.length > 0, watched: hist.length > 0 };
}

export async function markShowWatched(userId: number, showId: number) {
  await getPool().query(
    `INSERT IGNORE INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source)
     SELECT ?, 'episode', id, NOW(), 100, 'manual' FROM episodes WHERE show_id=?`,
    [userId, showId],
  );
}

export async function unmarkShowWatched(userId: number, showId: number) {
  await getPool().query(
    `DELETE wh FROM watch_history wh JOIN episodes e ON wh.media_id=e.id
     WHERE wh.user_id=? AND wh.media_type="episode" AND e.show_id=?`,
    [userId, showId],
  );
}

export async function toggleWatchlist(userId: number, mediaType: MediaType, mediaId: number) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM watchlist WHERE user_id=? AND media_type=? AND media_id=? FOR UPDATE',
      [userId, mediaType, mediaId],
    );
    let added: boolean;
    if (rows.length > 0) {
      await conn.query('DELETE FROM watchlist WHERE user_id=? AND media_type=? AND media_id=?', [userId, mediaType, mediaId]);
      added = false;
    } else {
      await conn.query('INSERT INTO watchlist (user_id, media_type, media_id) VALUES (?, ?, ?)', [userId, mediaType, mediaId]);
      added = true;
    }
    await conn.commit();
    return added;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function toggleCollection(userId: number, mediaType: MediaType, mediaId: number) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM collection WHERE user_id=? AND media_type=? AND media_id=? FOR UPDATE',
      [userId, mediaType, mediaId],
    );
	let added: boolean;
    if (rows.length > 0) {
      await conn.query('DELETE FROM collection WHERE user_id=? AND media_type=? AND media_id=?', [userId, mediaType, mediaId]);
      added = false;
    } else {
      await conn.query('INSERT INTO collection (user_id, media_type, media_id) VALUES (?, ?, ?)', [userId, mediaType, mediaId]);
      added = true;
    }
    await conn.commit();
    return added;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function removeFromWatchlist(userId: number, mediaType: MediaType, mediaId: number) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM watchlist WHERE user_id=? AND media_type=? AND media_id=?', [userId, mediaType, mediaId]);
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function removeFromCollection(userId: number, mediaType: MediaType, mediaId: number) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM collection WHERE user_id=? AND media_type=? AND media_id=?', [userId, mediaType, mediaId]);
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function markMovieWatched(userId: number, movieId: number) {
  const pool = getPool();
  await pool.query(
    `INSERT IGNORE INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source)
     VALUES (?, 'movie', ?, NOW(), 100, 'manual')`,
    [userId, movieId],
  );
}

export async function unmarkMovieWatched(userId: number, movieId: number) {
  await getPool().query(
    'DELETE FROM watch_history WHERE user_id=? AND media_type="movie" AND media_id=?',
    [userId, movieId],
  );
}

export async function markEpisodeWatched(userId: number, episodeId: number) {
  const pool = getPool();
  await pool.query(
    `INSERT IGNORE INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source)
     VALUES (?, 'episode', ?, NOW(), 100, 'manual')`,
    [userId, episodeId],
  );
}

export async function unmarkEpisodeWatched(userId: number, episodeId: number) {
  await getPool().query(
    'DELETE FROM watch_history WHERE user_id=? AND media_type="episode" AND media_id=?',
    [userId, episodeId],
  );
}

export async function getWatchedEpisodeIds(userId: number, showId: number) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT wh.media_id FROM watch_history wh
     JOIN episodes e ON wh.media_id = e.id
     WHERE wh.user_id=? AND wh.media_type="episode" AND e.show_id=?`,
    [userId, showId],
  );
  return rows.map((r) => r.media_id);
}
