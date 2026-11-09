import { createPublicKey } from 'node:crypto';

import { consoleLogger } from '@plitzi/sdk-kernel/log';
import { generateTokenKeys } from '@plitzi/sdk-kernel/tokens';
import { createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createAuth } from '@plitzi/sdk-server/auth';

import { accounts, verifyPassword } from './accounts.ts';
import { offlineData } from './space.ts';

import type { TokenKeys } from '@plitzi/sdk-kernel/tokens';

const PORT = Number(process.env.PORT ?? 4007);
// Loopback unless told otherwise: a container publishes a port only from an address it listens on.
const HOST = process.env.HOST ?? '127.0.0.1';

/**
 * Auth, in one call.
 *
 * Two things make this deployment its own: its signing key, and the issuer — credentials minted here verify
 * nowhere else, which is the same mechanism that keeps a dev token out of production. Everything after that is
 * the store you already have.
 */
/** The key pair a deployment keeps: its private key and its id, as `AUTH_SIGNING_KEY` (PEM) and `AUTH_KEY_ID`. */
const keysFromEnv = (): TokenKeys | undefined => {
  const privateKey = process.env.AUTH_SIGNING_KEY;
  const kid = process.env.AUTH_KEY_ID;
  if (!privateKey || !kid) {
    return undefined;
  }

  return {
    signing: { kid, privateKey },
    verifying: [{ kid, publicKey: createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }) }]
  };
};

const auth = createAuth({
  tokens: {
    // The deployment's key pair (`generateTokenKeys()` once, kept as a secret). Without one in the environment this
    // example makes a pair at start, so its sessions end when it restarts.
    keys: keysFromEnv() ?? generateTokenKeys(),
    issuer: `http://127.0.0.1:${PORT}`
  },
  // Signs the CSRF token: 32 characters or more, from `openssl rand -base64 48`.
  secret: process.env.AUTH_SECRET ?? 'example-secret-do-not-ship-it-is-public',
  // Say it once. The code that writes a session cookie and the code that reads one back both take it from here.
  cookie: { name: 'example_session' },
  adapters: accounts,
  api: { verifyPassword }
});

const space = createJsonAdapters({ offlineData: offlineData() });

const server = createServer({
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  logger: consoleLogger,
  adapters: space,
  // The whole of wiring sessions into a page server. `POST /auth/login` and `POST /auth/logout` now answer, the
  // rendered page knows who is looking at it, and the cookie naming travels with it — so there is no second place
  // to keep in step.
  auth
});

await server.listen(PORT, HOST);

console.log(`[example] a space with users on http://127.0.0.1:${PORT}/`);
console.log('[example] sign in:  curl -i -X POST http://127.0.0.1:%d/auth/login \\', PORT);
console.log("[example]             -H 'content-type: application/json' \\");
console.log('[example]             -d \'{"username":"ada","password":"password"}\'');
