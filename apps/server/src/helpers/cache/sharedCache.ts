import { randomUUID } from 'node:crypto';

import { serverLog } from '@plitzi/sdk-kernel/log';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { CacheFilter, CacheManager } from '../../types';
import type { SharedPageStore } from '../../types';
import type { PubSubAdapter } from '@plitzi/sdk-shared';

/** The topic the processes of a deployment tell each other what their pages no longer hold on. */
export const CACHE_TOPIC = 'ssr.cache';

const LABEL = 'SSR cache';

type CacheMessage = { op: 'invalidate'; filter: CacheFilter; from: string } | { op: 'clear'; from: string };

/** A filter as it travelled: only the fields a filter has, of the types it has them. */
export const cacheFilterOf = (value: unknown): CacheFilter => {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...(typeof value.spaceId === 'number' ? { spaceId: value.spaceId } : {}),
    ...(typeof value.environment === 'string' ? { environment: value.environment } : {}),
    ...(typeof value.hostname === 'string' ? { hostname: value.hostname } : {})
  };
};

const messageOf = (raw: string): CacheMessage | undefined => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!isRecord(value) || typeof value.from !== 'string') {
    return undefined;
  }

  if (value.op === 'clear') {
    return { op: 'clear', from: value.from };
  }

  return value.op === 'invalidate'
    ? { op: 'invalidate', filter: cacheFilterOf(value.filter), from: value.from }
    : undefined;
};

export type CacheSharing = { bus?: PubSubAdapter; store?: SharedPageStore };

/**
 * What says to every replica that pages no longer hold — and drops them from the store they share. For a process that
 * writes a space without serving its pages (an API beside the page servers): `server.cache` does the same where it
 * renders them. Rejects with what could not be said, so the write that called it can say the pages are stale.
 */
export const createCacheInvalidator = (
  { bus, store }: CacheSharing,
  from: string = randomUUID()
): { invalidate: (filter?: CacheFilter) => Promise<void>; clear: () => Promise<void> } => {
  const say = async (message: CacheMessage, filter?: CacheFilter): Promise<void> => {
    await Promise.all([bus?.publish(CACHE_TOPIC, JSON.stringify(message)), store?.invalidate(filter)]);
  };

  return {
    invalidate: filter => say({ op: 'invalidate', filter: filter ?? {}, from }, filter),
    clear: () => say({ op: 'clear', from })
  };
};

/**
 * `server.cache`, reaching every replica: what this process is told it does here, says on the bus for the others, and
 * drops from the shared store; what another says on the bus, it does here. Each process on the bus hears it, the
 * workers of one host included — so a deployment with a bus needs no relay of its own between them.
 */
export const shareCache = (
  cache: CacheManager,
  sharing: CacheSharing
): { cache: CacheManager; ready: Promise<void>; close: () => Promise<void> } => {
  const from = randomUUID();
  const invalidator = createCacheInvalidator(sharing, from);
  const told = (what: string) => (error: unknown) => {
    serverLog.warn(
      LABEL,
      `${what} reached only this process: the other replicas keep those pages until their TTL`,
      error
    );
  };

  let unsubscribe: (() => Promise<void>) | undefined;
  const ready = sharing.bus
    ? sharing.bus
        .subscribe(CACHE_TOPIC, raw => {
          const message = messageOf(raw);
          if (!message) {
            serverLog.warn(LABEL, `A message on ${CACHE_TOPIC} was ignored: it is not one this server sends`);

            return;
          }

          if (message.from === from) {
            return;
          }

          if (message.op === 'clear') {
            cache.clear();
          } else {
            cache.invalidate(message.filter);
          }
        })
        .then(stop => {
          unsubscribe = stop;
        })
        .catch((error: unknown) => {
          serverLog.warn(
            LABEL,
            `Not subscribed to ${CACHE_TOPIC}: what other replicas invalidate is kept here until its TTL`,
            error
          );
        })
    : Promise.resolve();

  return {
    cache: {
      invalidate: filter => {
        const count = cache.invalidate(filter);
        invalidator.invalidate(filter).catch(told('An invalidation'));

        return count;
      },
      clear: () => {
        cache.clear();
        invalidator.clear().catch(told('Clearing the cache'));
      },
      get size() {
        return cache.size;
      }
    },
    ready,
    close: async () => {
      await ready;
      await unsubscribe?.();
    }
  };
};
