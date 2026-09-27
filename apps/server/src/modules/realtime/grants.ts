import { randomBytes } from 'node:crypto';

import type { RealtimeSpace } from './hub';
import type { ActionKvAdapter } from '../actions/types';

/** How long a grant opens its topic when the flow does not say: a day, which outlives any one visit. */
export const DEFAULT_GRANT_SECONDS = 86_400;

/** The longest a grant may last: thirty days. A page that stays open longer asks its action for a new one. */
export const MAX_GRANT_SECONDS = 30 * 86_400;

/** What a grant looks like on the wire: long enough to be unguessable, and nothing a query string has to escape. */
const TOKEN = /^[A-Za-z0-9_-]{24,64}$/;

export type RealtimeGrants = {
  /** A grant for `topic`, good for `ttlSeconds` — what `realtime.grant` hands the page. */
  issue: (space: RealtimeSpace, topic: string, ttlSeconds?: number) => Promise<string>;
  /** Whether `grant` was issued for exactly `topic` of this space, and has not run out. */
  opens: (space: RealtimeSpace, topic: string, grant: string) => Promise<boolean>;
};

export const grantSeconds = (ttlSeconds: number | undefined): number =>
  ttlSeconds === undefined || !Number.isFinite(ttlSeconds)
    ? DEFAULT_GRANT_SECONDS
    : Math.min(MAX_GRANT_SECONDS, Math.max(60, Math.floor(ttlSeconds)));

/**
 * The grants a server has issued, kept in the store its actions' `kv` uses — so a grant one replica issued opens the
 * topic on whichever replica the page connects to, and nothing new has to be configured for it. A random token rather
 * than a signature: there is no secret to share between replicas, and a grant is only ever as old as its lifetime.
 *
 * Keyed under `realtime-grant:`, a prefix no key a flow writes can reach (theirs are `kv:action:<space>:…`).
 */
export const createRealtimeGrants = (store: ActionKvAdapter): RealtimeGrants => {
  const key = ({ spaceId, environment }: RealtimeSpace, grant: string): string =>
    `realtime-grant:${String(spaceId)}:${environment}:${grant}`;

  return {
    issue: async (space, topic, ttlSeconds) => {
      const grant = randomBytes(18).toString('base64url');
      await store.set(key(space, grant), topic, grantSeconds(ttlSeconds));

      return grant;
    },
    opens: async (space, topic, grant) => TOKEN.test(grant) && (await store.get(key(space, grant))) === topic
  };
};
