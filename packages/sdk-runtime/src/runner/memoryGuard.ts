import type { MemoryReading } from '@plitzi/sdk-kernel/stats';

/** How full of its memory a runner may get before it gives the largest invocation back: above where it takes new ones. */
export const SHED_SHARE = 0.92;

/** How long it waits after giving one back before it looks again: its memory takes a moment to come back. */
export const SHED_COOL_MS = 500;

export type MemoryGuard = {
  /** Looks once: past its share, gives the largest invocation back — unless it just did. Answers whether it did. */
  look: () => boolean;
};

/**
 * What keeps a runner from being killed for its invocations' memory.
 *
 * It takes an invocation while a share of what that one may grow to fits (`busy`), since most hold a few MB; nothing
 * kept the ones it took from growing together past its container's limit, and the kernel killed the runner — every
 * invocation in it with it (`closed with 1006`), 150 calls of one load round. Near its limit it gives back the one
 * whose isolate holds the most (`IsolateRunner.shed`): stopped at its own limit if it is past it, else handed back as
 * `busy` for another runner — one invocation said, never all of them lost.
 */
export const createMemoryGuard = ({
  readMemory,
  shed,
  share = SHED_SHARE,
  coolMs = SHED_COOL_MS,
  now = Date.now
}: {
  readMemory: () => MemoryReading;
  shed: () => boolean;
  share?: number;
  coolMs?: number;
  now?: () => number;
}): MemoryGuard => {
  let shedAt = Number.NEGATIVE_INFINITY;

  return {
    look: () => {
      const memory = readMemory();
      if (memory.usedBytes <= memory.limitBytes * share || now() - shedAt < coolMs) {
        return false;
      }

      if (!shed()) {
        return false;
      }

      shedAt = now();

      return true;
    }
  };
};
