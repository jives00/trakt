import { describe, it, expect, beforeEach, vi } from 'vitest';

process.env.POLL_INITIAL_DELAY = '10';
process.env.POLL_INTERVAL = '20';
process.env.POLL_SAFETY_TIMEOUT = '5000';

import { getPool, resetDb } from '../../test/helpers';
import { getTraktToken, setTraktToken, refreshTraktToken } from '../trakt-poll.service';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Trakt Poll Service', () => {
  beforeEach(async () => {
    await resetDb();
    mockFetch.mockClear();
  });

  describe('getTraktToken / setTraktToken', () => {
    it('stores and retrieves Trakt token', async () => {
      const token = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      await setTraktToken(token);
      const retrieved = await getTraktToken();

      expect(retrieved).toMatchObject({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });
      expect(retrieved?.expiresAt).toBeDefined();
    });

    it('returns null if no token exists', async () => {
      const token = await getTraktToken();
      expect(token).toBeNull();
    });

    it('updates existing token', async () => {
      await setTraktToken({
        accessToken: 'token1',
        refreshToken: 'refresh1',
        expiresAt: new Date(),
      });

      await setTraktToken({
        accessToken: 'token2',
        refreshToken: 'refresh2',
        expiresAt: new Date(),
      });

      const retrieved = await getTraktToken();
      expect(retrieved?.accessToken).toBe('token2');
    });
  });

  describe('refreshTraktToken', () => {
    it('calls Trakt OAuth endpoint to refresh token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      });

      await setTraktToken({
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
      });

      const result = await refreshTraktToken();

      expect(mockFetch).toHaveBeenCalledWith('https://api.trakt.tv/oauth/token', expect.objectContaining({
        method: 'POST',
        headers: expect.any(Object),
      }));
      expect(result.accessToken).toBe('new-access-token');
    });

    it('throws if refresh fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await setTraktToken({
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
      });

      await expect(refreshTraktToken()).rejects.toThrow();
    });

    it('throws if no refresh token exists', async () => {
      await expect(refreshTraktToken()).rejects.toThrow();
    });
  });

  describe('Token Storage', () => {
    it('persists token to database', async () => {
      const pool = getPool();

      await setTraktToken({
        accessToken: 'stored-token',
        refreshToken: 'stored-refresh',
        expiresAt: new Date(Date.now() + 7200000),
      });

      const [rows] = await pool.query('SELECT * FROM trakt_tokens WHERE id = 1');
      expect((rows as any[]).length).toBe(1);
      expect((rows as any[])[0].access_token).toBe('stored-token');
    });

    it('can update existing stored token', async () => {
      const pool = getPool();

      await setTraktToken({
        accessToken: 'token1',
        refreshToken: 'refresh1',
        expiresAt: new Date(),
      });

      await setTraktToken({
        accessToken: 'token2',
        refreshToken: 'refresh2',
        expiresAt: new Date(),
      });

      const [rows] = await pool.query('SELECT COUNT(*) as count FROM trakt_tokens');
      expect((rows as any[])[0].count).toBe(1);

      const token = await getTraktToken();
      expect(token?.accessToken).toBe('token2');
    });
  });
});
