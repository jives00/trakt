import { getTraktToken, setTraktToken } from './trakt-poll.service';

const TRAKT_API = 'https://api.trakt.tv';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  created_at: number;
}

interface AuthorizationStatus {
  status: 'pending' | 'authorized' | 'expired' | 'denied';
  expiresAt?: number;
}

let deviceCodeCache: {
  deviceCode: string;
  expiresAt: number;
} | null = null;

export async function initiateDeviceCodeFlow(): Promise<{ userCode: string; expiresIn: number }> {
  if (!process.env.TRAKT_CLIENT_ID) {
    throw new Error('TRAKT_CLIENT_ID not set in environment');
  }

  const res = await fetch(`${TRAKT_API}/oauth/device/code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'TraktClone/1.0 (+https://github.com/)',
    },
    body: JSON.stringify({
      client_id: process.env.TRAKT_CLIENT_ID,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to initiate device code flow: ${res.status} ${body}`);
  }

  const data = (await res.json()) as DeviceCodeResponse;

  deviceCodeCache = {
    deviceCode: data.device_code,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return {
    userCode: data.user_code,
    expiresIn: data.expires_in,
  };
}

export async function checkAuthorizationStatus(): Promise<AuthorizationStatus> {
  if (!deviceCodeCache) {
    return { status: 'expired' };
  }

  if (Date.now() > deviceCodeCache.expiresAt) {
    deviceCodeCache = null;
    return { status: 'expired' };
  }

  try {
    const res = await fetch(`${TRAKT_API}/oauth/device/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TraktClone/1.0 (+https://github.com/)',
      },
      body: JSON.stringify({
        client_id: process.env.TRAKT_CLIENT_ID,
        client_secret: process.env.TRAKT_CLIENT_SECRET,
        code: deviceCodeCache.deviceCode,
      }),
    });

    if (res.status === 400) {
      // Still pending
      return { status: 'pending', expiresAt: deviceCodeCache.expiresAt };
    }

    if (res.status === 401 || res.status === 403 || res.status === 409) {
      // Denied, expired, or code no longer valid
      deviceCodeCache = null;
      if (res.status === 403 || res.status === 409) return { status: 'expired' };
      return { status: 'denied' };
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to check authorization: ${res.status} ${body}`);
    }

    const data = (await res.json()) as TokenResponse;

    // Fetch user info to get username
    const userRes = await fetch(`${TRAKT_API}/users/me`, {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        'trakt-api-version': '2',
        'trakt-api-key': process.env.TRAKT_CLIENT_ID!,
        'User-Agent': 'TraktClone/1.0 (+https://github.com/)',
      },
    });

    let username = undefined;
    if (userRes.ok) {
      const userData = (await userRes.json()) as { username?: string };
      username = userData.username;
    }

    // Store the token with username
    await setTraktToken({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.created_at * 1000 + data.expires_in * 1000),
      username,
    });

    deviceCodeCache = null;
    return { status: 'authorized' };
  } catch (err) {
    console.error('Error checking authorization:', err);
    if (!deviceCodeCache) return { status: 'pending', expiresAt: null };
    return { status: 'pending', expiresAt: deviceCodeCache.expiresAt };
  }
}
