/**
 * One answer for the visitors asking the same question at the same moment — and, when the author says so, for the
 * ones asking it a moment later.
 *
 * A `render` is a READ repeated once per visitor. A thousand people opening one page is a thousand runs of the
 * same flow and a thousand outbound requests to whatever it reads, all in flight together, all computing the same
 * thing. Refusing them is the wrong answer — that is what a per-space cap did, and it broke the page that was
 * doing well. Sharing is the right one.
 *
 * Two behaviours, and only one of them is a cache:
 *
 * - **In flight**: a render that arrives while an identical one is running joins it. Always on, and it cannot
 *   serve anything stale — the answer is being computed right now, for this request as much as for the first.
 * - **Reuse**: the answer is kept for as long as the trigger's `cacheSeconds` says. Off unless authored, because
 *   only the author knows whether their page may repeat itself.
 *
 * A failure is never kept. The joiners of a failed run fail with it — they would have failed too — but the next
 * request tries again rather than being told for a minute about a request that was already over.
 *
 * In-process, and that is honest here in a way it is not for a lock: two replicas each keeping their own copy is
 * two computations instead of one, while two replicas each keeping their own LOCK is no lock at all.
 */

type Entry = {
  /** The run everyone joining right now is waiting on. */
  inFlight?: Promise<unknown>;
  /** What it answered, and until when it may be handed to somebody else. */
  value?: unknown;
  expiresAt?: number;
};

export type RenderShare = {
  /** Runs `produce`, or joins whatever is already producing the same key. `ttlMs` of 0 keeps nothing afterwards. */
  run: (key: string, ttlMs: number, produce: () => Promise<unknown>) => Promise<unknown>;
  /** Entries currently held, for a deployment that wants to see it. */
  size: () => number;
};

/** Keeps the map from growing without bound on a space with many keys: expired entries are dropped on write. */
const sweep = (entries: Map<string, Entry>, now: number) => {
  entries.forEach((entry, key) => {
    if (!entry.inFlight && (entry.expiresAt === undefined || entry.expiresAt <= now)) {
      entries.delete(key);
    }
  });
};

export const createRenderShare = (now: () => number = Date.now): RenderShare => {
  const entries = new Map<string, Entry>();

  const run = async (key: string, ttlMs: number, produce: () => Promise<unknown>): Promise<unknown> => {
    const existing = entries.get(key);
    if (existing?.inFlight) {
      return existing.inFlight;
    }

    if (existing && existing.expiresAt !== undefined && existing.expiresAt > now()) {
      return existing.value;
    }

    const inFlight = produce();
    entries.set(key, { inFlight });

    try {
      const value = await inFlight;
      sweep(entries, now());
      // Kept only if the author asked for it. Without a TTL the entry exists for the length of the run and no
      // longer, which is the whole of "join what is already happening".
      if (ttlMs > 0) {
        entries.set(key, { value, expiresAt: now() + ttlMs });
      } else {
        entries.delete(key);
      }

      return value;
    } catch (error) {
      // Never kept: an outage that lasted a second must not answer for a minute.
      entries.delete(key);

      throw error;
    }
  };

  return { run, size: () => entries.size };
};
