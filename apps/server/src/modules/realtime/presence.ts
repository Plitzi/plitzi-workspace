import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { RealtimeSpace } from './hub';
import type { ActionKvAdapter } from '../actions/types';
import type { RealtimeSender } from '@plitzi/sdk-shared';

/** How often a replica says its members are still there: a connection open for hours is seen every this often. */
export const PRESENCE_HEARTBEAT_MS = 30_000;

/** A member not seen this long is gone — its replica went down without saying it: three heartbeats missed. */
export const PRESENCE_STALE_MS = 3 * PRESENCE_HEARTBEAT_MS;

/** How many times a write is tried while other writes on the same topic keep landing first. */
const ATTEMPTS = 8;

/** One page on a presence channel, as every replica sees it. */
export type RealtimePresenceMember = {
  /** Its public name on the channel — the `from` of what it says. */
  from: string;
  /** Who is signed in on it, when someone is. */
  user?: RealtimeSender['user'];
  /** When it arrived, ms. */
  since: number;
};

export type RealtimePresence = {
  /** Records the pages that arrived on `topic` here — or are still on it, at a heartbeat: their `seenAt` moves on. */
  touch: (space: RealtimeSpace, topic: string, members: readonly RealtimePresenceMember[]) => Promise<void>;
  /** The page left `topic`. */
  depart: (space: RealtimeSpace, topic: string, from: string) => Promise<void>;
  /** Who is on `topic` now, on every replica, the earliest first — those not seen within {@link PRESENCE_STALE_MS} not. */
  of: (space: RealtimeSpace, topic: string) => Promise<RealtimePresenceMember[]>;
};

type Kept = Record<string, RealtimePresenceMember & { seenAt: number }>;

const isMember = (value: unknown): value is RealtimePresenceMember & { seenAt: number } =>
  isRecord(value) &&
  typeof value.from === 'string' &&
  typeof value.since === 'number' &&
  typeof value.seenAt === 'number' &&
  (value.user === undefined || isRecord(value.user));

/** A topic's members, as stored — read from a store something else could have written. */
const parseKept = (raw: string | undefined): Kept => {
  try {
    const value: unknown = JSON.parse(raw ?? '{}');

    return isRecord(value)
      ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, Kept[string]] => isMember(entry[1])))
      : {};
  } catch {
    return {};
  }
};

const fresh = (kept: Kept, now: number): Kept =>
  Object.fromEntries(Object.entries(kept).filter(([, member]) => now - member.seenAt < PRESENCE_STALE_MS));

/**
 * Who is on each presence channel, kept where the actions keep their `kv` — beside the grants and what `retain` keeps —
 * so a function on one replica counts the pages connected to all of them (`ctx.presence`). A page counted by its own
 * replica alone answered a room of three as one (encore's listeners, counted by the pages' own heartbeats in kv).
 *
 * One value per topic, written by compare-and-swap; each member carries when its replica last saw it, so one that went
 * down without a word stops counting within {@link PRESENCE_STALE_MS}, and is dropped at the next write.
 */
export const createRealtimePresence = (store: ActionKvAdapter, now: () => number = Date.now): RealtimePresence => {
  const key = ({ spaceId, environment }: RealtimeSpace, topic: string): string =>
    `realtime-presence:${String(spaceId)}:${environment}:${topic}`;
  const change = async (space: RealtimeSpace, topic: string, next: (kept: Kept) => Kept): Promise<void> => {
    const at = key(space, topic);
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const raw = await store.get(at);
      const written = JSON.stringify(next(fresh(parseKept(raw), now())));
      // A topic nobody is on keeps no value: forgotten once the last one leaves, or goes stale.
      if (await store.swap(at, raw, written, Math.ceil(PRESENCE_STALE_MS / 1000))) {
        return;
      }
    }

    throw new Error(`"${topic}" changed under ${String(ATTEMPTS)} writes in a row: its presence was not recorded`);
  };

  return {
    touch: (space, topic, members) =>
      change(space, topic, kept => ({
        ...kept,
        ...Object.fromEntries(
          members.map(member => [member.from, { ...(kept[member.from] ?? member), seenAt: now() }] as const)
        )
      })),
    depart: (space, topic, from) =>
      change(space, topic, kept => Object.fromEntries(Object.entries(kept).filter(([name]) => name !== from))),
    of: async (space, topic) =>
      Object.values(fresh(parseKept(await store.get(key(space, topic))), now()))
        .map(member => ({ from: member.from, since: member.since, ...(member.user ? { user: member.user } : {}) }))
        .sort((a, b) => a.since - b.since)
  };
};
