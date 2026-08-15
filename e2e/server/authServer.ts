import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createAuth } from '@plitzi/sdk-server/auth';

import { accounts, verifyPassword } from './accounts';
import { authSpace } from '../spaces/auth';

/** The suite's page server WITH people in it, on its own port.
 *
 *  Separate from `main.ts` on purpose: everything there renders one anonymous space, and threading a session
 *  through those specs would make every one of them depend on auth. Here auth is the subject, so it is the only
 *  thing switched on beyond the pages. */

export const PORT = Number(process.env.PORT ?? 4201);
const COOKIE = 'e2e_session';

/** Two things make this deployment its own: the signing secret and the issuer. Credentials minted here verify
 *  nowhere else — the same mechanism that keeps a dev token out of production. */
const auth = createAuth({
  tokens: { secret: 'e2e-auth-secret-not-for-anything-real', issuer: `http://127.0.0.1:${PORT}` },
  // Said once. The code that writes a session cookie and the code that reads one back both take it from here.
  cookie: { name: COOKIE },
  adapters: accounts,
  api: { verifyPassword }
});

const server = createServer({
  port: PORT,
  devMode: true,
  logger: consoleLogger,
  adapters: createJsonAdapters({ offlineData: authSpace({ sessionHintCookie: `${COOKIE}_hint` }) }),
  auth
});

server.listen(PORT, '127.0.0.1');
console.log(`[e2e] a space with users on http://127.0.0.1:${PORT}/`);
