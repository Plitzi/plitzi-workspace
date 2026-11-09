import { describe, expect, it, vi } from 'vitest';

import { createMemoryGuard } from './memoryGuard';

const MB = 1_048_576;

describe('a runner short of memory', () => {
  /**
   * The regression it guards: the invocations a runner took grew together past its container's limit, and the kernel
   * killed it with all of them in it. Past its share it gives the largest back — one, then waits for its memory.
   */
  it('gives one invocation back past its share, and waits before it gives another', () => {
    let at = 0;
    const shed = vi.fn(() => true);
    const guard = createMemoryGuard({
      readMemory: () => ({ usedBytes: 950 * MB, limitBytes: 1000 * MB }),
      shed,
      share: 0.92,
      coolMs: 500,
      now: () => at
    });

    expect(guard.look()).toBe(true);
    at = 100;
    expect(guard.look()).toBe(false);
    at = 600;
    expect(guard.look()).toBe(true);
    expect(shed).toHaveBeenCalledTimes(2);
  });

  it('gives nothing back while it is under its share', () => {
    const shed = vi.fn(() => true);
    const guard = createMemoryGuard({ readMemory: () => ({ usedBytes: 800 * MB, limitBytes: 1000 * MB }), shed });

    expect(guard.look()).toBe(false);
    expect(shed).not.toHaveBeenCalled();
  });
});
