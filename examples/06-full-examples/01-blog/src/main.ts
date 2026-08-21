import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createAuth } from '@plitzi/sdk-server/auth';

import { accounts, verifyPassword } from './accounts';
import { lookups } from './actions';
import { offlineData } from './space';
import { blogTasks } from './tasks';

const PORT = Number(process.env.PORT ?? 4013);

/**
 * A blog, in one server.
 *
 * Three things are configured and nothing else is: who the people are, what the space can do on the server, and
 * the space itself. Sessions, routing, rendering, the write endpoint and the data every page reads come out of
 * those three.
 */
const auth = createAuth({
  tokens: {
    secret: process.env.AUTH_SECRET ?? 'example-secret-do-not-ship',
    issuer: `http://127.0.0.1:${PORT}`
  },
  // Said once: the code that writes a session cookie and the code that reads one back both take it from here.
  cookie: { name: 'blog_session' },
  adapters: accounts,
  api: { verifyPassword }
});

const server = createServer({
  port: PORT,
  devMode: true,
  logger: consoleLogger,
  adapters: createJsonAdapters({ offlineData: offlineData() }),
  auth,
  /**
   * What turns the server half on. `lookups` is how this deployment reaches an action — with no way to read one
   * there is no endpoint at all — and `tasks` is its own half of the step catalog: what a space can do on the
   * server is decided by the process running it.
   *
   * The two reads on the pages are `render` triggers rather than calls, so they cost nothing extra to enable:
   * the same module resolves them while the page is built.
   */
  action: {
    lookups,
    tasks: blogTasks,
    onRun: record =>
      console.log(`[blog] ${record.actionId} via ${record.trigger} — ${record.status} in ${record.durationMs}ms`),
    // A refusal is not a run, and it is the half worth watching while permissions are being set up.
    onReject: record => console.log(`[blog] ${record.actionId} refused — ${record.reason}`)
  }
});

server.listen(PORT, '127.0.0.1');

console.log(`[blog] the blog on http://127.0.0.1:${PORT}/`);
console.log('[blog] sign in as ada / password to publish, or grace / password to be refused');
