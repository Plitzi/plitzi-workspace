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
  // Required, and the reason is the line above: `account`, `role` and `session` are names anything might already
  // have. A prefix you chose makes a collision mean a real collision.
  tablePrefix: process.env.MYSQL_TABLE_PREFIX ?? 'plitzi_',
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
  adapters: {
    ...store.authAdapters,
    /**
     * The one adapter the store cannot supply: where mail goes. A real deployment hands this to its provider —
     * here it prints, so the sign-in code and the verification link are readable without an SMTP account.
     *
     * Supplying it is what turns `passwordless` and the reset flows on. `GET /auth/capabilities` reports the
     * result, and there is no second switch that could disagree with it.
     */
    sendMail: message => {
      console.log(`[example] mail → ${message.to} (${message.template}):`, message.data);

      return Promise.resolve();
    }
  },
  api: {
    ...store.passwords,
    // Every act worth recording, in one feed: an audit trail, a webhook and an alert are the same thing.
    onEvent: event => console.log(`[example] ${event.type}`, { userId: event.userId, actorId: event.actorId })
  }
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
