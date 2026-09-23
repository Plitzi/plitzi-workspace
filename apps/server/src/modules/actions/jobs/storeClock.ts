/**
 * The clock of the store a queue lives in, read cheaply.
 *
 * Every comparison a queue makes — is this due, has this lease lapsed — is made against ONE clock, and a cluster whose
 * replicas sit in different countries only agrees on the store's. Reading it on every call would put a round trip on
 * the path of every claim and every heartbeat, so it is read once and then trusted for the ELAPSED time only: the one
 * thing a wrong local clock still gets right is how long thirty seconds is.
 */
export type StoreClock = {
  /** The store's now, in epoch ms. */
  now: () => Promise<number>;
  /** Forgets the reading, so the next call takes it again — after a failover to another primary, or in a test. */
  resync: () => void;
};

/** How long a reading is trusted before it is taken again. */
const RESYNC_MS = 30_000;

/** `read` answers the store's own time in epoch ms: `hello.localTime` on Mongo, `NOW(3)` on MySQL. */
export const createStoreClock = (read: () => Promise<number>, resyncMs = RESYNC_MS): StoreClock => {
  let offset = 0;
  let readAt = Number.NEGATIVE_INFINITY;
  let pending: Promise<void> | undefined;

  const sync = async (): Promise<void> => {
    const before = Date.now();
    const storeTime = await read();
    const after = Date.now();
    // Halfway through the round trip is the best guess at when the store took its reading.
    offset = storeTime - Math.round((before + after) / 2);
    readAt = after;
  };

  return {
    now: async () => {
      if (Date.now() - readAt >= resyncMs) {
        // Shared, so a burst of concurrent claims costs one round trip rather than one each.
        pending ??= sync().finally(() => {
          pending = undefined;
        });
        await pending;
      }

      return Date.now() + offset;
    },
    resync: () => {
      readAt = Number.NEGATIVE_INFINITY;
    }
  };
};
