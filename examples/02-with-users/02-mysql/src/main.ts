import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createAuth } from '@plitzi/sdk-server/auth';
import { createMysqlStore } from '@plitzi/sdk-server/mysql';

import { seed } from './seed';
// The same two pages as the sessions example. What changes here is not what gets rendered — it is where the people
// come from, and copying two hundred lines of page definition across would bury the one difference that matters.
import { offlineData } from '../../01-sessions/src/space';

const PORT = Number(process.env.PORT ?? 4008);
const COOKIE = 'example_mysql_session';

/**
 * Where the database is.
 *
 * Asked for rather than assumed — which is the honest shape for this: a store that hard-codes a host works on
 * exactly one machine. The defaults point at the MySQL this repository already runs in docker, so the example
 * starts with no arguments, and every one of them is an environment variable away from somebody else's server.
 */
const store = await createMysqlStore({
  url: process.env.DATABASE_URL,
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 33006),
  user: process.env.MYSQL_USER ?? 'user',
  password: process.env.MYSQL_PASSWORD ?? 'password',
  // Its own database on a server that has others. Nothing here touches anything outside it.
  database: process.env.MYSQL_DATABASE ?? 'plitzi_example',
  // Both are development conveniences and both say so: the point of an example is that it runs, and neither
  // creating a database nor altering tables is something a production application should be able to do.
  ensureDatabase: true,
  autoMigrate: true,
  log: message => console.log(message)
});

await seed(store);

/**
 * Auth over those tables.
 *
 * `store.authAdapters` is every adapter `createAuth` asks for, already written — accounts by token, by username, by
 * refresh token, the session cycle, the global roles, the space memberships. Compare with the sibling example,
 * where the same object is a file you maintain: that file is the price of bringing your own user table, and this is
 * what it costs not to have one.
 */
const auth = createAuth({
  tokens: {
    secret: process.env.AUTH_SECRET ?? 'example-secret-do-not-ship',
    issuer: `http://127.0.0.1:${PORT}`
  },
  cookie: { name: COOKIE },
  adapters: store.authAdapters,
  api: store.passwords
});

const server = createServer({
  port: PORT,
  devMode: true,
  logger: consoleLogger,
  adapters: createJsonAdapters({ offlineData: offlineData({ sessionHintCookie: `${COOKIE}_hint` }) }),
  auth
});

server.listen(PORT, '127.0.0.1');

// The pool outlives the process otherwise: node will not exit while a MySQL connection is open, so ^C hangs.
const shutdown = (): void => {
  void store.close().finally(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`[example] a space with your own users on http://127.0.0.1:${PORT}/`);
console.log('[example] sign in as ada / password, or grace / password');
