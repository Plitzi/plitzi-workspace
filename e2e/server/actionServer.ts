import { createServer } from '@plitzi/sdk-server';

import { MAIL_SINK } from '../helpers/mail';
import {
  actionSpace,
  FEED_ACTION,
  MAIL_ACTION,
  MAIL_CREDENTIAL,
  MAIL_FROM,
  SLOW_ACTION,
  UNCONFIGURED_MAIL_ACTION,
  UNREACHABLE_ACTION
} from '../spaces';

import type { ActionEntry } from '@plitzi/sdk-shared';

/**
 * The suite's server for one wiring in particular: **actions and nothing else.**
 *
 * Its own process rather than a flag on `server/main.ts`, because what it is about is what it does NOT have. That
 * one writes its own `getRscData` and needs to — its RSC specs are about the three runtimes and their slices —
 * and an adapter the deployment supplies is precisely the case where the server stops assembling one. Here there
 * is no adapter, no connector and no plugin: a page, an action, and the expectation that a `runtime: 'server'`
 * element still resolves.
 *
 * A space wired this way is ordinary — the read a manifest cannot express is what actions are for — and for a
 * while it rendered empty sections with nothing missing from its configuration.
 */

export const PORT = Number(process.env.PORT ?? 5202);

const space = actionSpace();

const actions = [FEED_ACTION, SLOW_ACTION, UNREACHABLE_ACTION, MAIL_ACTION, UNCONFIGURED_MAIL_ACTION] as ActionEntry[];

/** The space's one credential: its SMTP server, which is the suite's mail sink (`server/mailSink.ts`). */
const credentials: Record<string, Record<string, string>> = {
  [MAIL_CREDENTIAL]: {
    host: '127.0.0.1',
    port: String(MAIL_SINK.smtpPort),
    security: 'none',
    username: '',
    password: '',
    fromEmail: MAIL_FROM.address,
    fromName: MAIL_FROM.name
  }
};

const lookups = {
  getAction: (_spaceId: number, actionId: string): Promise<ActionEntry | undefined> =>
    Promise.resolve(actions.find(entry => entry.id === actionId)),
  getCredential: (_spaceId: number, identifier: string): Promise<Record<string, string> | undefined> =>
    Promise.resolve(credentials[identifier])
};

const server = createServer({
  port: PORT,
  devMode: true,
  adapters: {
    getOfflineData: () => Promise.resolve(space),
    getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 })
  },
  /**
   * Caches off: several specs render the same URL and read what came back per request, and a five-minute HTML
   * cache would answer the second one with the first one's page.
   */
  cacheTtlMs: 0,
  /**
   * The page's own ceiling for one section, set low on purpose: `SLOW_ACTION` is allowed two seconds of its own
   * and must still be cut off here, because a section is worth waiting for only as long as the visitor is.
   */
  rsc: { cacheTtlMs: 0, elementTimeoutMs: 800 },
  // Nothing raised here on purpose: the suite loads this page from every worker at once, and the defaults are
  // expected to carry that. They did not until renders stopped drawing on the per-space CALL budget.
  // `allowPrivateHosts` because the space's SMTP server is the sink on 127.0.0.1; a hosted server leaves it off.
  action: { lookups, email: { allowPrivateHosts: true } }
});

server.listen(PORT, '127.0.0.1');
console.log(`[e2e] pages fed by actions on http://127.0.0.1:${PORT}/`);
