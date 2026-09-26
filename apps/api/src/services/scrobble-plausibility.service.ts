import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';
import { FALLBACK_RUNTIME_MIN } from './scrobble.service';

// Percentage points a stop may run ahead of the time-based estimate (clock skew,
// buffering, runtime metadata that's a few minutes off).
const SLACK_PCT = 10;

// Nuvio reports a hardcoded 99.5% whenever the player hits STATE_ENDED, including a
// stream that dies partway through. Check the claim against the session we already
// have: last reported position plus the time elapsed since, over the runtime.
export async function isPlausibleCompletion(
  userId: number,
  mediaType: 'movie' | 'episode',
  mediaId: number,
  reportedPct: number
): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT np.progress_pct AS progressPct, np.paused,
            TIMESTAMPDIFF(SECOND, np.updated_at, NOW()) AS elapsedSec,
            COALESCE(m.runtime_min, e.runtime_min, s.runtime_min) AS runtimeMin
     FROM now_playing np
     LEFT JOIN movies m   ON np.media_type = 'movie'   AND m.id = np.media_id
     LEFT JOIN episodes e ON np.media_type = 'episode' AND e.id = np.media_id
     LEFT JOIN tv_shows s ON s.id = e.show_id
     WHERE np.user_id = ? AND np.media_type = ? AND np.media_id = ?`,
    [userId, mediaType, mediaId]
  );
  // No session to compare against — nothing to contradict the client.
  if (rows.length === 0) return true;

  const r = rows[0];
  const runtimeMin = r.runtimeMin > 0 ? r.runtimeMin : FALLBACK_RUNTIME_MIN[mediaType];
  const watchedPct = r.paused ? 0 : (r.elapsedSec / (runtimeMin * 60)) * 100;
  const ceiling = r.progressPct + watchedPct + SLACK_PCT;
  if (reportedPct <= ceiling) return true;
  console.log(`🚫 Implausible completion — ${mediaType} id=${mediaId} reported ${reportedPct}%, ceiling ${Math.round(ceiling)}%`);
  return false;
}
