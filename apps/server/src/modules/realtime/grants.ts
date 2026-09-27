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
  /** Whether `grant` was issued for exactly `topic` of this space, and has neither run out nor been revoked. */
  opens: (space: RealtimeSpace, topic: string, grant: string) => Promise<boolean>;
  /** `grant` no longer opens `topic` — or, with none named, no grant issued for it until now does. */
  revoke: (space: RealtimeSpace, topic: string, grant?: string) => Promise<void>;
};

/** What a grant is kept as: its topic, and the topic's generation when it was issued — a revoke-all raises it. */
type StoredGrant = { topic: string; generation: number };

const parseGrant = (raw: string | undefined): StoredGrant | undefined => {
  try {
    const value: unknown = JSON.parse(raw ?? '');

    return typeof value === 'object' &&
      value !== null &&
      'topic' in value &&
      typeof value.topic === 'string' &&
      'generation' in value &&
      typeof value.generation === 'number'
      ? { topic: value.topic, generation: value.generation }
      : undefined;
  } catch {
    return undefined;
  }
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
  /**
   * How many times every grant of a topic was revoked at once. A grant carries the number it was issued under, so
   * raising it voids them all — the ones in use and the ones not used yet — without a list of them to walk.
   */
  const generationKey = ({ spaceId, environment }: RealtimeSpace, topic: string): string =>
    `realtime-grant-generation:${String(spaceId)}:${environment}:${topic}`;
  const generationOf = async (space: RealtimeSpace, topic: string): Promise<number> =>
    Number(await store.get(generationKey(space, topic))) || 0;

  return {
    issue: async (space, topic, ttlSeconds) => {
      const grant = randomBytes(18).toString('base64url');
      const stored: StoredGrant = { topic, generation: await generationOf(space, topic) };
      await store.set(key(space, grant), JSON.stringify(stored), grantSeconds(ttlSeconds));

      return grant;
    },
    opens: async (space, topic, grant) => {
      if (!TOKEN.test(grant)) {
        return false;
      }

      const stored = parseGrant(await store.get(key(space, grant)));

      return stored?.topic === topic && stored.generation === (await generationOf(space, topic));
    },
    revoke: async (space, topic, grant) => {
      if (grant === undefined) {
        await store.increment(generationKey(space, topic), 1);

        return;
      }

      if (TOKEN.test(grant) && parseGrant(await store.get(key(space, grant)))?.topic === topic) {
        await store.delete(key(space, grant));
      }
    }
  };
};
