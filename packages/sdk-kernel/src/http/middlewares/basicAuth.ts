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
    const passwords = (req.ctx.spaceDeployment?.credentials ?? []).filter(credential => credential.provider === 'ssr');
    if (passwords.length === 0) {
      await next();

      return;
    }

    // A site password is a user and a password, and any one of the host's opens it (a version's preview carries every
    // one its space's addresses ask). One without both is never met: a password that cannot be checked keeps the site
    // closed — it once let everybody in, for a kind of password nothing checked.
    const hostname = req.hostname;
    const expected = passwords.flatMap(({ data }) => {
      const pair: Record<string, unknown> = isRecord(data) ? data : {};

      return typeof pair.user === 'string' && pair.user !== '' && typeof pair.pass === 'string' && pair.pass !== ''
        ? [{ user: pair.user, pass: pair.pass }]
        : [];
    });
    if (expected.length === 0) {
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
      .update([hostname, ...expected.flatMap(({ user, pass }) => [user, pass]), token].join('\0'))
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

    const actualUser = Buffer.from(decoded.slice(0, colonIdx));
    const actualPass = Buffer.from(decoded.slice(colonIdx + 1));
    const sameAs = (actual: Buffer, wanted: string): boolean => {
      const expectedBytes = Buffer.from(wanted);

      return actual.length === expectedBytes.length && crypto.timingSafeEqual(actual, expectedBytes);
    };
    // Every pair is compared, whichever matches: how long the answer takes says nothing of which one did.
    const matches = expected.map(({ user, pass }) => sameAs(actualUser, user) && sameAs(actualPass, pass));
    if (!matches.includes(true)) {
      sendChallenge(res, hostname, realm);

      return;
    }

    authCache.set(cacheKey, true);

    await next();
  };
};
