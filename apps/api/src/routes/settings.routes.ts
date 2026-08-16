import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RowDataPacket } from 'mysql2/promise';
import { authenticate } from '../middleware/auth';
import { getPool } from '../db';

function userId(request: FastifyRequest): number {
  return (request.user as { sub: number }).sub;
}

export async function settingsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [authenticate] };

  app.get('/settings/api-key', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = process.env.SCROBBLE_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ error: 'API key not configured' });
    }
    return reply.send({ scrobbleApiKey: apiKey });
  });

  app.get('/settings/preferences', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT watch_threshold_movie, watch_threshold_episode FROM users WHERE id = ?',
      [userId(request)]
    );
    if (rows.length === 0) return reply.status(404).send({ error: 'User not found' });
    return reply.send({
      watchThresholdMovie: rows[0].watch_threshold_movie as number,
      watchThresholdEpisode: rows[0].watch_threshold_episode as number,
    });
  });

  app.put<{ Body: { watchThresholdMovie?: number; watchThresholdEpisode?: number } }>(
    '/settings/preferences',
    auth,
    async (request: FastifyRequest<{ Body: { watchThresholdMovie?: number; watchThresholdEpisode?: number } }>, reply: FastifyReply) => {
      const { watchThresholdMovie, watchThresholdEpisode } = request.body;
      const clamp = (n: number) => Math.min(100, Math.max(1, Math.round(n)));

      const movie = typeof watchThresholdMovie === 'number' ? clamp(watchThresholdMovie) : null;
      const episode = typeof watchThresholdEpisode === 'number' ? clamp(watchThresholdEpisode) : null;

      if (movie === null && episode === null) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      const pool = getPool();
      const updates: string[] = [];
      const params: (number)[] = [];
      if (movie !== null) { updates.push('watch_threshold_movie = ?'); params.push(movie); }
      if (episode !== null) { updates.push('watch_threshold_episode = ?'); params.push(episode); }
      params.push(userId(request));

      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
      return reply.send({ watchThresholdMovie: movie, watchThresholdEpisode: episode });
    }
  );

  app.get('/settings/source-stats', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT source, COUNT(*) AS count FROM watch_history WHERE user_id = ? GROUP BY source',
      [userId(request)]
    );
    const stats: Record<string, number> = {};
    for (const row of rows) {
      stats[row.source as string] = Number(row.count);
    }
    return reply.send(stats);
  });
}
