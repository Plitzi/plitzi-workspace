import { isMessage } from './message';

import type { RealtimeSpace } from './hub';
import type { ActionKvAdapter } from '../actions/types';
import type { RealtimeMessage } from '@plitzi/sdk-shared';

/** The most types one topic keeps: state a page shows, never a log written one type per entry. */
export const MAX_RETAINED_TYPES = 64;

/** The most one topic keeps, as JSON: every page that joins is sent all of it. */
export const MAX_RETAINED_BYTES = 512 * 1024;

/** How many times a write is tried while other writes on the same topic keep landing first. */
const ATTEMPTS = 8;

export type RealtimeRetained = {
  /**
   * Keeps `message` as its topic's latest of its type — or, with `null` data, forgets the type. Refused, before anything
   * is sent, past {@link MAX_RETAINED_TYPES} types or {@link MAX_RETAINED_BYTES} for the topic. With `ttlSeconds`, the
   * topic is forgotten that long after it last changed — a job's, which ends.
   */
  keep: (space: RealtimeSpace, message: RealtimeMessage, ttlSeconds?: number) => Promise<void>;
  /** What a topic keeps: the latest message of each type, oldest first. */
  of: (space: RealtimeSpace, topic: string) => Promise<RealtimeMessage[]>;
};

/** A topic's kept messages, by type, as stored — read from a store something else could have written. */
const parseKept = (raw: string | undefined): Record<string, RealtimeMessage> => {
  try {
    const value: unknown = JSON.parse(raw ?? '{}');
    if (typeof value !== 'object' || value === null) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, RealtimeMessage] => isMessage(entry[1]))
    );
  } catch {
    return {};
  }
};

/**
 * The messages of `retain: true` channels, kept in the store the actions' `kv` uses — beside the grants, so one replica
 * keeps what another hands a page that joins, and nothing new has to be configured for it.
 *
 * One value per topic, written by compare-and-swap: two types said at once on one topic are both kept, never one
 * written over the other. Keyed under `realtime-retained:`, which no key a flow writes can reach.
 */
export const createRealtimeRetained = (store: ActionKvAdapter): RealtimeRetained => {
  const key = ({ spaceId, environment }: RealtimeSpace, topic: string): string =>
    `realtime-retained:${String(spaceId)}:${environment}:${topic}`;

  return {
    keep: async (space, message, ttlSeconds) => {
      const at = key(space, message.topic);
      for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
        const raw = await store.get(at);
        const kept = parseKept(raw);
        const others = Object.fromEntries(Object.entries(kept).filter(([type]) => type !== message.type));
        const next = message.data === null ? others : { ...others, [message.type]: message };
        if (Object.keys(next).length > MAX_RETAINED_TYPES) {
          throw new Error(
            `"${message.topic}" keeps at most ${String(MAX_RETAINED_TYPES)} types of message: keep fewer, larger ones (one \`lists\` holding every list), or forget one with null`
          );
        }

        const written = JSON.stringify(next);
        if (Buffer.byteLength(written) > MAX_RETAINED_BYTES) {
          throw new Error(
            `"${message.topic}" keeps at most ${String(MAX_RETAINED_BYTES / 1024)} KB, and "${message.type}" would take it past that: every page that joins is sent all of it — keep there what the screens show, the rest in kv`
          );
        }

        if (await store.swap(at, raw, written, ttlSeconds)) {
          return;
        }
      }

      throw new Error(
        `"${message.topic}" changed under ${String(ATTEMPTS)} writes in a row, so "${message.type}" was not kept: publish it again`
      );
    },
    of: async (space, topic) => Object.values(parseKept(await store.get(key(space, topic)))).sort((a, b) => a.at - b.at)
  };
};
