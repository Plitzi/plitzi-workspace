import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createAuth } from '@plitzi/sdk-server/kernel';

import { offlineDataPath } from '@plitzi/example-space';

import { accounts, verifyPassword } from './accounts';

const PORT = Number(process.env.PORT ?? 4007);

/**
 * Auth, in one call.
 *
 * Two things make this deployment its own: the signing secret, and the issuer — credentials minted here verify
 * nowhere else, which is the same mechanism that keeps a dev token out of production. Everything after that is
 * the store you already have.
 */
const auth = createAuth({
  tokens: {
    secret: process.env.AUTH_SECRET ?? 'example-secret-do-not-ship',
    issuer: `http://127.0.0.1:${PORT}`
  },
  // Say it once. The code that writes a session cookie and the code that reads one back both take it from here.
  cookie: { name: 'example_session' },
  adapters: accounts,
  api: { verifyPassword }
});

const space = createJsonAdapters({ offlineData: offlineDataPath });

const server = createServer({
  port: PORT,
  devMode: true,
  logger: consoleLogger,
  adapters: space,
  // The whole of wiring sessions into a page server. `POST /auth/login` and `POST /auth/logout` now answer, the
  // rendered page knows who is looking at it, and the cookie naming travels with it — so there is no second place
  // to keep in step.
  auth
});

server.listen(PORT, '127.0.0.1');

console.log(`[example] a space with users on http://127.0.0.1:${PORT}/`);
console.log('[example] sign in:  curl -i -X POST http://127.0.0.1:%d/auth/login \\', PORT);
console.log("[example]             -H 'content-type: application/json' \\");
console.log('[example]             -d \'{"username":"ada","password":"password"}\'');
