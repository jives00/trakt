import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';

type MediaType = 'movie' | 'show';

const ENDED_STATUSES = ['Ended', 'Canceled', 'Cancelled'];

async function getSystemListId(userId: number, listType: 'watchlist' | 'dropped' | 'rewatch'): Promise<number> {
  const [[row]] = await getPool().query<RowDataPacket[]>(
    'SELECT id FROM lists WHERE user_id=? AND list_type=? AND is_system=TRUE',
    [userId, listType],
  );
  if (!row) throw new Error(`System ${listType} list not found for user ${userId}`);
  return row.id;
}

export async function getMovieStatus(userId: number, movieId: number) {
  const pool = getPool();
  const [[wl], [hist]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT li.id FROM list_items li JOIN lists l ON l.id=li.list_id
       WHERE l.user_id=? AND l.list_type='watchlist' AND li.media_type='movie' AND li.media_id=?`,
      [userId, movieId],
    ),
    pool.query<RowDataPacket[]>(
      'SELECT id FROM watch_history WHERE user_id=? AND media_type="movie" AND media_id=?',
      [userId, movieId],
    ),
  ]);
  return { inWatchlist: wl.length > 0, watched: hist.length > 0 };
}

export async function getShowStatus(userId: number, showId: number) {
  const pool = getPool();
  const [[wl], [dropped], [rewatch], [hist]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT li.id FROM list_items li JOIN lists l ON l.id=li.list_id
       WHERE l.user_id=? AND l.list_type='watchlist' AND li.media_type='show' AND li.media_id=?`,
      [userId, showId],
    ),
    pool.query<RowDataPacket[]>(
      `SELECT li.id FROM list_items li JOIN lists l ON l.id=li.list_id
       WHERE l.user_id=? AND l.list_type='dropped' AND li.media_type='show' AND li.media_id=?`,
      [userId, showId],
    ),
    pool.query<RowDataPacket[]>(
      `SELECT li.id FROM list_items li JOIN lists l ON l.id=li.list_id
       WHERE l.user_id=? AND l.list_type='rewatch' AND li.media_type='show' AND li.media_id=?`,
      [userId, showId],
    ),
    pool.query<RowDataPacket[]>(
      `SELECT wh.id FROM watch_history wh JOIN episodes e ON wh.media_id=e.id
       WHERE wh.user_id=? AND wh.media_type="episode" AND e.show_id=? LIMIT 1`,
      [userId, showId],
    ),
  ]);
  return {
    inWatchlist: wl.length > 0,
    inDropped: dropped.length > 0,
    inRewatch: rewatch.length > 0,
    watched: hist.length > 0,
  };
}

export async function toggleWatchlist(userId: number, mediaType: MediaType, mediaId: number) {
  const pool = getPool();
  const listId = await getSystemListId(userId, 'watchlist');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM list_items WHERE list_id=? AND media_type=? AND media_id=? FOR UPDATE',
      [listId, mediaType, mediaId],
    );
    let added: boolean;
    if (rows.length > 0) {
      await conn.query('DELETE FROM list_items WHERE list_id=? AND media_type=? AND media_id=?', [listId, mediaType, mediaId]);
      added = false;
    } else {
      await conn.query('INSERT INTO list_items (list_id, media_type, media_id) VALUES (?, ?, ?)', [listId, mediaType, mediaId]);
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

// Removes from watchlist. For shows, also adds to dropped ("dismissed" flow).
export async function removeFromWatchlist(userId: number, mediaType: MediaType, mediaId: number) {
  const pool = getPool();
  const watchlistId = await getSystemListId(userId, 'watchlist');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'DELETE FROM list_items WHERE list_id=? AND media_type=? AND media_id=?',
      [watchlistId, mediaType, mediaId],
    );
    if (mediaType === 'show') {
      const droppedId = await getSystemListId(userId, 'dropped');
      await conn.query(
        'INSERT IGNORE INTO list_items (list_id, media_type, media_id) VALUES (?, ?, ?)',
        [droppedId, 'show', mediaId],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Toggles dropped. Adding: removes from watchlist too. Removing: re-adds to watchlist.
export async function toggleDropped(userId: number, showId: number) {
  const pool = getPool();
  const [watchlistId, droppedId] = await Promise.all([
    getSystemListId(userId, 'watchlist'),
    getSystemListId(userId, 'dropped'),
  ]);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM list_items WHERE list_id=? AND media_type="show" AND media_id=? FOR UPDATE',
      [droppedId, showId],
    );
    let dropped: boolean;
    if (rows.length > 0) {
      // Un-drop: remove from dropped, re-add to watchlist
      await conn.query('DELETE FROM list_items WHERE list_id=? AND media_type="show" AND media_id=?', [droppedId, showId]);
      await conn.query(
        'INSERT IGNORE INTO list_items (list_id, media_type, media_id) VALUES (?, "show", ?)',
        [watchlistId, showId],
      );
      dropped = false;
    } else {
      // Drop: add to dropped, remove from watchlist
      await conn.query(
        'INSERT INTO list_items (list_id, media_type, media_id) VALUES (?, "show", ?)',
        [droppedId, showId],
      );
      await conn.query(
        'DELETE FROM list_items WHERE list_id=? AND media_type="show" AND media_id=?',
        [watchlistId, showId],
      );
      dropped = true;
    }
    await conn.commit();
    return dropped;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Toggles rewatch. Adding: removes from dropped if present.
export async function toggleRewatch(userId: number, showId: number) {
  const pool = getPool();
  const [rewatchId, droppedId] = await Promise.all([
    getSystemListId(userId, 'rewatch'),
    getSystemListId(userId, 'dropped'),
  ]);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM list_items WHERE list_id=? AND media_type="show" AND media_id=? FOR UPDATE',
      [rewatchId, showId],
    );
    let rewatching: boolean;
    if (rows.length > 0) {
      await conn.query('DELETE FROM list_items WHERE list_id=? AND media_type="show" AND media_id=?', [rewatchId, showId]);
      rewatching = false;
    } else {
      await conn.query(
        'INSERT INTO list_items (list_id, media_type, media_id) VALUES (?, "show", ?)',
        [rewatchId, showId],
      );
      // Clear dropped status when starting a rewatch
      await conn.query(
        'DELETE FROM list_items WHERE list_id=? AND media_type="show" AND media_id=?',
        [droppedId, showId],
      );
      rewatching = true;
    }
    await conn.commit();
    return rewatching;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function checkMovieWatchlistCompletion(userId: number, movieId: number) {
  await getPool().query(
    `DELETE li FROM list_items li
     JOIN lists l ON l.id=li.list_id
     WHERE l.user_id=? AND l.list_type='watchlist' AND li.media_type='movie' AND li.media_id=?`,
    [userId, movieId],
  );
}

export async function checkShowWatchlistCompletion(userId: number, showId: number) {
  const pool = getPool();
  const [[wlRow]] = await pool.query<RowDataPacket[]>(
    `SELECT li.id FROM list_items li JOIN lists l ON l.id=li.list_id
     WHERE l.user_id=? AND l.list_type='watchlist' AND li.media_type='show' AND li.media_id=?`,
    [userId, showId],
  );
  if (!wlRow) return;

  const [[showRow]] = await pool.query<RowDataPacket[]>(
    'SELECT status FROM tv_shows WHERE id=?',
    [showId],
  );
  if (!showRow || !ENDED_STATUSES.includes(showRow.status ?? '')) return;

  const [[{ unwatched }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS unwatched
     FROM episodes e
     JOIN seasons s ON s.id=e.season_id AND s.season_number > 0 AND (s.season_type IS NULL OR s.season_type != 'special')
     WHERE e.show_id=? AND e.air_date <= CURDATE()
     AND NOT EXISTS (
       SELECT 1 FROM watch_history wh
       WHERE wh.media_type='episode' AND wh.media_id=e.id AND wh.user_id=?
     )`,
    [showId, userId],
  );
  if (unwatched === 0) {
    await pool.query('DELETE FROM list_items WHERE id=?', [wlRow.id]);
  }
}

// Called after marking an episode watched — checks if a rewatch run is complete.
export async function checkRewatchCompletion(userId: number, showId: number) {
  const pool = getPool();
  const [[rewatchRow]] = await pool.query<RowDataPacket[]>(
    `SELECT li.id, li.added_at AS rewatchStart FROM list_items li
     JOIN lists l ON l.id=li.list_id
     WHERE l.user_id=? AND l.list_type='rewatch' AND li.media_type='show' AND li.media_id=?`,
    [userId, showId],
  );
  if (!rewatchRow) return;

  // Check if every aired episode has been watched after rewatchStart
  const [[{ unwatched }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS unwatched
     FROM episodes e
     JOIN seasons s ON s.id=e.season_id AND s.season_number > 0 AND (s.season_type IS NULL OR s.season_type != 'special')
     WHERE e.show_id=? AND e.air_date <= CURDATE()
     AND NOT EXISTS (
       SELECT 1 FROM watch_history wh
       WHERE wh.media_type='episode' AND wh.media_id=e.id AND wh.user_id=? AND wh.watched_at > ?
     )`,
    [showId, userId, rewatchRow.rewatchStart],
  );

  if (unwatched === 0) {
    await pool.query('DELETE FROM list_items WHERE id=?', [rewatchRow.id]);
  }
}

export async function markShowWatched(userId: number, showId: number, watchedAt?: string) {
  let sql: string;
  let params: unknown[];

  if (watchedAt === 'release_date') {
    sql = `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source, completion_progress)
           SELECT ?, 'episode', id, COALESCE(air_date, NOW()), 100, 'manual', 100 FROM episodes WHERE show_id=?`;
    params = [userId, showId];
  } else if (watchedAt) {
    sql = `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source, completion_progress)
           SELECT ?, 'episode', id, ?, 100, 'manual', 100 FROM episodes WHERE show_id=?`;
    params = [userId, watchedAt, showId];
  } else {
    sql = `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source, completion_progress)
           SELECT ?, 'episode', id, NOW(), 100, 'manual', 100 FROM episodes WHERE show_id=?`;
    params = [userId, showId];
  }

  await getPool().query(sql, params);
  await checkShowWatchlistCompletion(userId, showId);
}

export async function unmarkShowWatched(userId: number, showId: number) {
  await getPool().query(
    `DELETE wh FROM watch_history wh JOIN episodes e ON wh.media_id=e.id
     WHERE wh.user_id=? AND wh.media_type="episode" AND e.show_id=?`,
    [userId, showId],
  );
}

export async function markMovieWatched(userId: number, movieId: number, watchedAt?: string) {
  const pool = getPool();
  if (watchedAt) {
    await pool.query(
      `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source, completion_progress)
       VALUES (?, 'movie', ?, ?, 100, 'manual', 100)`,
      [userId, movieId, watchedAt],
    );
  } else {
    await pool.query(
      `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source, completion_progress)
       VALUES (?, 'movie', ?, NOW(), 100, 'manual', 100)`,
      [userId, movieId],
    );
  }
  await checkMovieWatchlistCompletion(userId, movieId);
}

export async function unmarkMovieWatched(userId: number, movieId: number) {
  await getPool().query(
    'DELETE FROM watch_history WHERE user_id=? AND media_type="movie" AND media_id=?',
    [userId, movieId],
  );
}

export async function markEpisodeWatched(userId: number, episodeId: number, watchedAt?: string) {
  const pool = getPool();
  if (watchedAt) {
    await pool.query(
      `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source, completion_progress)
       VALUES (?, 'episode', ?, ?, 100, 'manual', 100)`,
      [userId, episodeId, watchedAt],
    );
  } else {
    await pool.query(
      `INSERT INTO watch_history (user_id, media_type, media_id, watched_at, progress_pct, source, completion_progress)
       VALUES (?, 'episode', ?, NOW(), 100, 'manual', 100)`,
      [userId, episodeId],
    );
  }
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
