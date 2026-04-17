import crypto from 'node:crypto';

import type { SSRMiddleware, SSRContext, SSRCredential } from '../types';

/** In-memory cache: tokenHash → timestamp of last successful auth */
const authCache = new Map<string, number>();

/** Default TTL in milliseconds (5 minutes) */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

const sendChallenge = (res: Parameters<SSRMiddleware>[1], domain: string, realm: string): void => {
  res.setHeader('WWW-Authenticate', `Basic realm="${realm} - ${domain}", charset="UTF-8"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setStatus(401);
  res.end();
};

export type BasicAuthOptions = {
  realm?: string;
  /** Cache TTL in milliseconds. Defaults to 5 minutes. */
  cacheTtlMs?: number;
};

/**
 * Basic-auth middleware.
 *
 * Reads the credential from `ctx.spaceDeployment.credential` (populated by
 * the space-deployment middleware). If the credential type is not `'basic'`,
 * the middleware passes through immediately.
 *
 * Successful auth results are cached in-memory to avoid re-checking every
 * request (replacing the Redis-based cache in the original implementation).
 */
export const basicAuthMiddleware = (options: BasicAuthOptions = {}): SSRMiddleware => {
  const { realm = 'Restricted Area', cacheTtlMs = DEFAULT_CACHE_TTL_MS } = options;

  return async (req, res, next) => {
    const ctx = req as typeof req & SSRContext;
    const credential = ctx.spaceDeployment?.credential as SSRCredential | undefined;

    if (!credential || credential.provider !== 'ssr') {
      await next();
      return;
    }

    const { data: credentials } = credential as { data: { type: 'basic' | 'token'; user: string; pass: string } };
    if (credentials.type !== 'basic') {
      await next();
      return;
    }

    const hostname = req.hostname;
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      sendChallenge(res, hostname, realm);
      return;
    }

    let token: string;
    let decoded: string;
    try {
      token = authHeader.slice(6);
      decoded = Buffer.from(token, 'base64').toString('utf8');
    } catch {
      sendChallenge(res, hostname, realm);
      return;
    }

    // Check in-memory cache
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const cacheKey = `${hostname}:${tokenHash}`;
    const now = Date.now();
    const cachedAt = authCache.get(cacheKey);
    if (cachedAt !== undefined) {
      if (now - cachedAt < cacheTtlMs) {
        await next();
        return;
      }
      // Expired — remove and re-validate
      authCache.delete(cacheKey);
      sendChallenge(res, hostname, realm);
      return;
    }

    const [user, pass] = decoded.split(':');
    if (!user || !pass || user !== credentials.user || pass !== credentials.pass) {
      sendChallenge(res, hostname, realm);
      return;
    }

    // Store successful auth in cache
    authCache.set(cacheKey, now);

    await next();
  };
};
