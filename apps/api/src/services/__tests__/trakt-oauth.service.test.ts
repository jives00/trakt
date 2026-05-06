import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initiateDeviceCodeFlow, checkAuthorizationStatus } from '../trakt-oauth.service';
import { getTraktToken } from '../trakt-poll.service';
import { resetDb } from '../../test/helpers';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Trakt OAuth Service', () => {
  beforeEach(async () => {
    await resetDb();
    mockFetch.mockClear();
  });

  describe('initiateDeviceCodeFlow', () => {
    it('calls Trakt device code endpoint and returns user code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'device-123',
          user_code: 'ABCD-1234',
          verification_url: 'https://trakt.tv/activate',
          expires_in: 600,
          interval: 5,
        }),
      });

      const result = await initiateDeviceCodeFlow();

      expect(mockFetch).toHaveBeenCalledWith('https://api.trakt.tv/oauth/device/code', expect.any(Object));
      expect(result.userCode).toBe('ABCD-1234');
      expect(result.expiresIn).toBe(600);
    });

    it('throws if device code endpoint fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(initiateDeviceCodeFlow()).rejects.toThrow();
    });
  });

  describe('checkAuthorizationStatus', () => {
    it('returns pending if user has not authorized yet (400 response)', async () => {
      // First, initiate the flow
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'device-123',
          user_code: 'ABCD-1234',
          verification_url: 'https://trakt.tv/activate',
          expires_in: 600,
          interval: 5,
        }),
      });

      await initiateDeviceCodeFlow();
      mockFetch.mockClear();

      // Then check authorization status (still pending)
      mockFetch.mockResolvedValueOnce({
        status: 400,
      });

      const status = await checkAuthorizationStatus();

      expect(status.status).toBe('pending');
      expect(status.expiresAt).toBeDefined();
    });

    it('stores token and returns authorized when user authorizes (200 response)', async () => {
      // Initiate flow
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'device-123',
          user_code: 'ABCD-1234',
          verification_url: 'https://trakt.tv/activate',
          expires_in: 600,
          interval: 5,
        }),
      });

      await initiateDeviceCodeFlow();
      mockFetch.mockClear();

      // Check authorization - user authorized
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'trakt-access-token',
          token_type: 'Bearer',
          expires_in: 7200,
          refresh_token: 'trakt-refresh-token',
          scope: 'public private',
          created_at: Math.floor(Date.now() / 1000),
        }),
      });

      const status = await checkAuthorizationStatus();

      expect(status.status).toBe('authorized');

      // Verify token was stored
      const storedToken = await getTraktToken();
      expect(storedToken?.accessToken).toBe('trakt-access-token');
      expect(storedToken?.refreshToken).toBe('trakt-refresh-token');
    });

    it('returns denied when authorization is denied (401 response)', async () => {
      // Initiate flow
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'device-123',
          user_code: 'ABCD-1234',
          verification_url: 'https://trakt.tv/activate',
          expires_in: 600,
          interval: 5,
        }),
      });

      await initiateDeviceCodeFlow();
      mockFetch.mockClear();

      // Check authorization - denied
      mockFetch.mockResolvedValueOnce({
        status: 401,
      });

      const status = await checkAuthorizationStatus();

      expect(status.status).toBe('denied');
    });

    it('returns expired when device code expires (403 response)', async () => {
      // Initiate flow
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'device-123',
          user_code: 'ABCD-1234',
          verification_url: 'https://trakt.tv/activate',
          expires_in: 600,
          interval: 5,
        }),
      });

      await initiateDeviceCodeFlow();
      mockFetch.mockClear();

      // Check authorization - expired
      mockFetch.mockResolvedValueOnce({
        status: 403,
      });

      const status = await checkAuthorizationStatus();

      expect(status.status).toBe('expired');
    });

    it('returns expired if no device code is cached', async () => {
      const status = await checkAuthorizationStatus();

      expect(status.status).toBe('expired');
    });
  });

  describe('Full OAuth Flow', () => {
    it('completes end-to-end device code flow', async () => {
      // Step 1: Initiate flow
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'device-123',
          user_code: 'ABCD-1234',
          verification_url: 'https://trakt.tv/activate',
          expires_in: 600,
          interval: 5,
        }),
      });

      const initResult = await initiateDeviceCodeFlow();
      expect(initResult.userCode).toBe('ABCD-1234');

      // Step 2: Check status (still pending)
      mockFetch.mockResolvedValueOnce({
        status: 400,
      });

      let status = await checkAuthorizationStatus();
      expect(status.status).toBe('pending');

      // Step 3: User authorizes, check again
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'new-access-token',
          token_type: 'Bearer',
          expires_in: 7200,
          refresh_token: 'new-refresh-token',
          scope: 'public private',
          created_at: Math.floor(Date.now() / 1000),
        }),
      });

      status = await checkAuthorizationStatus();
      expect(status.status).toBe('authorized');

      // Verify token was stored
      const token = await getTraktToken();
      expect(token?.accessToken).toBe('new-access-token');
    });
  });
});
