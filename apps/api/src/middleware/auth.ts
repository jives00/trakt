import { FastifyRequest, FastifyReply } from 'fastify';
import { isTrustedClient, isAllowedScrobbleSource, normalizeIp } from '../utils/trustedNetwork';

// True when the request comes from a trusted network (home LAN / Tailscale / docker-internal)
// and carries no Cloudflare tunnel headers. Uses the raw socket peer address (not request.ip)
// so a spoofed X-Forwarded-For cannot fake trust. The Cloudflare-header check keeps public
// tunnel traffic (trakt.berek.xyz → trakt-api) from ever minting a passwordless session.
export function isTrustedRequest(request: FastifyRequest): boolean {
  return isTrustedClient(
    request.headers as Record<string, unknown>,
    request.socket.remoteAddress,
    process.env.TRUSTED_CIDRS,
  );
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    const code = (err as any)?.code as string | undefined;
    if (typeof code === 'string' && code.startsWith('FST_JWT')) {
      request.log.warn(`auth failed — ${request.method} ${request.url} (${code})`);
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    throw err;
  }
}

// The real client IP: Cloudflare's header for tunnel traffic, else the socket peer.
export function scrobbleClientIp(request: FastifyRequest): string {
  return normalizeIp(String(request.headers['cf-connecting-ip'] ?? request.socket.remoteAddress ?? ''));
}

export async function authenticateScrobble(request: FastifyRequest, reply: FastifyReply) {
  const headers = request.headers as Record<string, unknown>;
  if (!isAllowedScrobbleSource(headers, request.socket.remoteAddress, process.env.SCROBBLE_ALLOWED_IPS)) {
    console.log(`🔒 Scrobble blocked — ${request.method} ${request.url} from ${scrobbleClientIp(request)}`);
    return reply.status(403).send({ error: 'Forbidden' });
  }
  const key = request.headers['x-api-key'] ?? (request.query as Record<string, string>)['api_key'];
  if (!key || key !== process.env.SCROBBLE_API_KEY) {
    console.log(`🔒 Scrobble auth failed — ${request.method} ${request.url} key=${key ? '(present but wrong)' : '(missing)'} from ${scrobbleClientIp(request)}`);
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}
