import crypto from 'node:crypto';

import { DEFAULT_TTL_MS, TtlCache } from '../helpers/cache';

import type { SSRMiddleware } from '@plitzi/sdk-shared';

const sendChallenge = (res: Parameters<SSRMiddleware>[1], domain: string, realm: string): void => {
  res.setHeader('WWW-Authenticate', `Basic realm="${realm} - ${domain}", charset="UTF-8"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setStatus(401);
  res.end();
};

export type BasicAuthOptions = {
  realm?: string;
  cacheTtlMs?: number;
};

export const basicAuthMiddleware = (options: BasicAuthOptions = {}): SSRMiddleware => {
  const { realm = 'Restricted Area', cacheTtlMs = DEFAULT_TTL_MS.auth } = options;
  // Scoped TtlCache — bounded to 10 000 entries with automatic TTL eviction.
  // Replaces the old module-level Map which grew unboundedly under token-flooding attacks.
  const authCache = new TtlCache<true>(cacheTtlMs, 10_000);

  return async (req, res, next) => {
    const credential = req.ctx.spaceDeployment?.credential;

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
    const authHeader = req.headers['authorization'];
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

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const cacheKey = `${hostname}:${tokenHash}`;

    if (authCache.get(cacheKey)) {
      await next();

      return;
    }

    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) {
      sendChallenge(res, hostname, realm);

      return;
    }

    const user = decoded.slice(0, colonIdx);
    const pass = decoded.slice(colonIdx + 1);

    const expectedUser = Buffer.from(credentials.user);
    const expectedPass = Buffer.from(credentials.pass);
    const actualUser = Buffer.from(user);
    const actualPass = Buffer.from(pass);

    const userMatch = actualUser.length === expectedUser.length && crypto.timingSafeEqual(actualUser, expectedUser);
    const passMatch = actualPass.length === expectedPass.length && crypto.timingSafeEqual(actualPass, expectedPass);

    if (!userMatch || !passMatch) {
      sendChallenge(res, hostname, realm);

      return;
    }

    authCache.set(cacheKey, true);

    await next();
  };
};
