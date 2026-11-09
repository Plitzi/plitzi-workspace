import { consoleLogger } from '@plitzi/sdk-kernel/log';
import { generateTokenKeys } from '@plitzi/sdk-kernel/tokens';
import { createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createAuth } from '@plitzi/sdk-server/auth';

import { accounts, verifyPassword } from './accounts';
import { PORTS } from '../launchConfig';
import { authSpace, PROBE_PATH } from '../spaces/auth';

import type { Stage } from '@plitzi/sdk-kernel/http';

/** The suite's page server WITH people in it, on its own port.
 *
 *  Separate from `main.ts` on purpose: everything there renders one anonymous space, and threading a session
 *  through those specs would make every one of them depend on auth. Here auth is the subject, so it is the only
 *  thing switched on beyond the pages. */

export const PORT = Number(process.env.PORT ?? PORTS.authServer);
const COOKIE = 'e2e_session';

/** Two things make this deployment its own: its signing key and the issuer. Credentials minted here verify nowhere
 *  else — the same mechanism that keeps a dev token out of production. The CSRF tokens are signed with `secret`. */
const auth = createAuth({
  tokens: { keys: generateTokenKeys('e2e'), issuer: `http://127.0.0.1:${PORT}` },
  secret: 'e2e-csrf-secret-not-for-anything-real-at-all',
  // Said once. The code that writes a session cookie and the code that reads one back both take it from here.
  cookie: { name: COOKIE },
  adapters: accounts,
  api: { verifyPassword }
});

/** What the space's two probe providers ask for. Answered here so nothing in this space ever 404s, which every
 *  spec would otherwise fail on: a request the browser refuses is a console error. */
const probeAnswers: Stage = ({ req, res }) => {
  if (!req.path.startsWith(`${PROBE_PATH}/`)) {
    return false;
  }

  res.setStatus(200);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ name: req.path.slice(`${PROBE_PATH}/`.length) }));

  return true;
};

const server = createServer(
  {
    port: PORT,
    devMode: true,
    logger: consoleLogger,
    adapters: createJsonAdapters({ offlineData: authSpace({ sessionHintCookie: `${COOKIE}_hint` }) }),
    auth
  },
  // Before the auth chain: what it answers is the same for everybody, and a signed-out visitor asks for it too.
  { preAuth: [probeAnswers] }
);

await server.listen(PORT, '127.0.0.1');
console.log(`[e2e] a space with users on http://127.0.0.1:${PORT}/`);
