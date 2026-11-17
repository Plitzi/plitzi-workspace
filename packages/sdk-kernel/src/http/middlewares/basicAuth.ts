import crypto from 'node:crypto';

import { TtlCache } from '../../cache/TtlCache';
import { isRecord } from '../../data/isRecord';

import type { SSRMiddleware } from '../../types';

const sendChallenge = (res: Parameters<SSRMiddleware>[1], domain: string, realm: string): void => {
  res.setHeader('WWW-Authenticate', `Basic realm="${realm} - ${domain}", charset="UTF-8"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setStatus(401);
  res.end();
};

/** How long a checked credential is believed without asking again. */
const CREDENTIAL_TTL_MS = 5 * 60 * 1000;

export type BasicAuthOptions = {
  realm?: string;
  cacheTtlMs?: number;
};

export const basicAuthMiddleware = (options: BasicAuthOptions = {}): SSRMiddleware => {
  const { realm = 'Restricted Area', cacheTtlMs = CREDENTIAL_TTL_MS } = options;
  // Scoped TtlCache — bounded to 10 000 entries with automatic TTL eviction.
  // Replaces the old module-level Map which grew unboundedly under token-flooding attacks.
  const authCache = new TtlCache<true>(cacheTtlMs, 10_000);

  return async (req, res, next) => {
    const credential = req.ctx.spaceDeployment?.credential;

    if (!credential || credential.provider !== 'ssr') {
      await next();

      return;
    }

    // A site password is a user and a password. One without both is asked for and never met: a credential that cannot
    // be checked keeps the site closed — it once let everybody in, for a kind of password nothing checked.
    const hostname = req.hostname;
    const data: Record<string, unknown> = isRecord(credential.data) ? credential.data : {};
    const expected =
      typeof data.user === 'string' && data.user !== '' && typeof data.pass === 'string' && data.pass !== ''
        ? { user: data.user, pass: data.pass }
        : undefined;
    if (!expected) {
      sendChallenge(res, hostname, realm);

      return;
    }

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

    // What was sent AND what is expected: a password changed is asked again at once, never believed for the rest of
    // the TTL because it once matched the old one.
    const cacheKey = crypto
      .createHash('sha256')
      .update(`${hostname}\0${expected.user}\0${expected.pass}\0${token}`)
      .digest('hex');

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

    const expectedUser = Buffer.from(expected.user);
    const expectedPass = Buffer.from(expected.pass);
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
