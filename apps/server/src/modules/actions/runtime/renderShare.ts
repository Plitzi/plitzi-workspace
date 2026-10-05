import { onAbort } from '../../../helpers/onAbort';

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
  /** Stops that run — once nobody is waiting for it any more. */
  controller?: AbortController;
  /** How many are still waiting for it. */
  waiting: number;
  /** What it answered, and until when it may be handed to somebody else. */
  value?: unknown;
  expiresAt?: number;
};

export type RenderShare = {
  /**
   * Runs `produce`, or joins whatever is already producing the same key. `ttlMs` of 0 keeps nothing afterwards.
   *
   * `signal` is this caller's: aborted, the caller stops waiting — and the run is stopped (`produce`'s own signal)
   * only once every caller waiting on it has. One visitor who gave up must not cost the others their answer.
   */
  run: (
    key: string,
    ttlMs: number,
    produce: (signal: AbortSignal) => Promise<unknown>,
    signal?: AbortSignal
  ) => Promise<unknown>;
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

/** What a caller that stopped waiting is answered with: its own end, not the run's. */
const stoppedWaiting = (): Error =>
  new DOMException('The render was aborted: its page stopped waiting for it', 'AbortError');

/** One caller waiting on a run in flight, until it answers or the caller gives up — whichever comes first. */
const wait = (entry: Entry, inFlight: Promise<unknown>, signal: AbortSignal | undefined): Promise<unknown> => {
  entry.waiting += 1;
  let waiting = true;
  const leave = () => {
    if (!waiting) {
      return;
    }

    waiting = false;
    entry.waiting -= 1;
    if (entry.waiting === 0) {
      entry.controller?.abort();
    }
  };

  return new Promise((resolve, reject) => {
    const release = onAbort(signal, () => {
      leave();
      reject(stoppedWaiting());
    });
    inFlight.then(
      value => {
        waiting = false;
        release();
        resolve(value);
      },
      (error: unknown) => {
        waiting = false;
        release();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
};

export const createRenderShare = (now: () => number = Date.now): RenderShare => {
  const entries = new Map<string, Entry>();

  const run: RenderShare['run'] = async (key, ttlMs, produce, signal) => {
    const existing = entries.get(key);
    if (existing?.inFlight) {
      return wait(existing, existing.inFlight, signal);
    }

    if (existing && existing.expiresAt !== undefined && existing.expiresAt > now()) {
      return existing.value;
    }

    const controller = new AbortController();
    const inFlight = produce(controller.signal);
    const entry: Entry = { inFlight, controller, waiting: 0 };
    entries.set(key, entry);
    // Settled once, whoever is still waiting: what is kept afterwards is the run's business, not a caller's.
    inFlight.then(
      value => {
        sweep(entries, now());
        // Kept only if the author asked for it. Without a TTL the entry exists for the length of the run and no
        // longer, which is the whole of "join what is already happening".
        if (ttlMs > 0) {
          entries.set(key, { value, expiresAt: now() + ttlMs, waiting: 0 });
        } else if (entries.get(key) === entry) {
          entries.delete(key);
        }
      },
      () => {
        // Never kept: an outage that lasted a second must not answer for a minute.
        if (entries.get(key) === entry) {
          entries.delete(key);
        }
      }
    );

    return wait(entry, inFlight, signal);
  };

  return { run, size: () => entries.size };
};
