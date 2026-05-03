const BASE = 'https://api4.thetvdb.com/v4';

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: process.env.TVDB_API_KEY ?? '' }),
  });
  if (!res.ok) throw new Error(`TVDB login ${res.status}`);
  const data = await res.json() as { data: { token: string } };
  tokenCache = { token: data.data.token, expiresAt: Date.now() + 12 * 60 * 60 * 1000 };
  return tokenCache.token;
}

async function get<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`TVDB ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// Converts "8:00 PM" or "20:00" to "20:00:00" for MySQL TIME column
function parseAirTime(airsTime: string | null | undefined): string | null {
  if (!airsTime) return null;
  const match = airsTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

// Returns MySQL TIME string (e.g. "20:00:00") or null if unavailable
export async function fetchSeriesAirTime(tvdbId: number): Promise<string | null> {
  const { airTime } = await fetchSeriesAirInfo(tvdbId);
  return airTime;
}

export async function fetchSeriesAirInfo(tvdbId: number): Promise<{ airTime: string | null; airsDay: string | null }> {
  const data = await get<{ data: { airsTime?: string | null; airsDays?: Record<string, boolean> | null } }>(`/series/${tvdbId}/extended`);
  const airTime = parseAirTime(data.data.airsTime);
  const days = data.data.airsDays;
  let airsDay: string | null = null;
  if (days) {
    const found = Object.entries(days).find(([, v]) => v);
    if (found) airsDay = found[0].charAt(0).toUpperCase() + found[0].slice(1) + 's';
  }
  return { airTime, airsDay };
}
