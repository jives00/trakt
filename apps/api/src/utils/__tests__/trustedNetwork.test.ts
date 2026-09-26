import { describe, expect, it } from 'vitest';
import { isAllowedScrobbleSource } from '../trustedNetwork';

const tunnel = (ip: string) => ({ 'cf-connecting-ip': ip, 'cf-ray': 'x' });

describe('isAllowedScrobbleSource', () => {
  it('allows direct LAN and Tailscale traffic', () => {
    expect(isAllowedScrobbleSource({}, '::ffff:192.168.1.20', '203.0.113.7')).toBe(true);
    expect(isAllowedScrobbleSource({}, '100.101.102.103', '203.0.113.7')).toBe(true);
  });

  it('rejects direct traffic from a public address', () => {
    expect(isAllowedScrobbleSource({}, '198.51.100.9', '203.0.113.7')).toBe(false);
  });

  it('leaves the tunnel open when no allowlist is set', () => {
    expect(isAllowedScrobbleSource(tunnel('198.51.100.9'), '127.0.0.1', undefined)).toBe(true);
  });

  it('only admits allow-listed public IPs through the tunnel', () => {
    const allow = '203.0.113.7, 2001:db8::1, 198.51.100.0/24';
    expect(isAllowedScrobbleSource(tunnel('203.0.113.7'), '127.0.0.1', allow)).toBe(true);
    expect(isAllowedScrobbleSource(tunnel('2001:db8::1'), '127.0.0.1', allow)).toBe(true);
    expect(isAllowedScrobbleSource(tunnel('198.51.100.42'), '127.0.0.1', allow)).toBe(true);
    expect(isAllowedScrobbleSource(tunnel('192.0.2.1'), '127.0.0.1', allow)).toBe(false);
  });
});
