import { createServer } from '@plitzi/sdk-server';

import { MAIL_SINK } from '../helpers/mail';
import {
  actionSpace,
  FEED_ACTION,
  MAIL_ACTION,
  MAIL_CREDENTIAL,
  MAIL_FROM,
  SLOW_ACTION,
  UNREACHABLE_ACTION
} from '../spaces';

import type { ActionEntry } from '@plitzi/sdk-shared';

/**
 * The same space as `actionServer.ts`, served the way a real site is: **not a development server.**
 *
 * Its own process because `devMode` is a property of the DEPLOYMENT, and what these specs are about is what a
 * published page is told about the flows behind it. Two of them run, from this one module:
 *
 * - `PORT` 5205, the space as published — nobody authorized debugging, and the page is told nothing: not the steps,
 *   not the runs the render started, not even that a flow ran behind an empty section.
 * - `PORT` 5206 with `E2E_SPACE_DEBUG_MODE`, the same space with the owner's dev-tools setting switched on — the
 *   page gets the OUTLINE of what its flows did, and still never what a step read or answered.
 *
 * Between them and the dev server, the three ways debugging can be authorized are each covered by a page somebody
 * can actually load.
 */

export const PORT = Number(process.env.PORT ?? 5205);

/** What the space's own settings say, which is the half of the answer a deployment leaves to the owner. */
const spaceDebugMode = process.env.E2E_SPACE_DEBUG_MODE === '1';

const space = actionSpace(spaceDebugMode);

const actions = [FEED_ACTION, SLOW_ACTION, UNREACHABLE_ACTION, MAIL_ACTION] as ActionEntry[];

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
  // The whole point of this server. Left out entirely rather than set false: this is what a deployment that never
  // thought about it looks like, and the page must be told nothing all the same.
  adapters: {
    getOfflineData: () => Promise.resolve(space),
    getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'production', revision: 1 })
  },
  // Off for the same reason as the dev server's: several specs read the same URL and each wants its own render.
  cacheTtlMs: 0,
  rsc: { cacheTtlMs: 0, elementTimeoutMs: 800 },
  action: { lookups, email: { allowPrivateHosts: true } }
});

server.listen(PORT, '127.0.0.1');
console.log(`[e2e] a published site${spaceDebugMode ? ' with dev tools on' : ''} on http://127.0.0.1:${PORT}/`);
