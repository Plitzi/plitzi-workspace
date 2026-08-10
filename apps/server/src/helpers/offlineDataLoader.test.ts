import { describe, expect, it, vi } from 'vitest';

import { createOfflineDataLoader } from './offlineDataLoader';

import type { OfflineDataRaw } from '@plitzi/sdk-shared';

const space = { schema: {}, style: {} } as unknown as OfflineDataRaw;

describe('createOfflineDataLoader', () => {
  /**
   * The case it exists for: the page render and the RSC read start together, so the second caller arrives while the
   * first read is still in flight. Counting calls after both settle would pass on a loader that only cached the
   * result — the assertion has to be that the second caller never started a read of its own.
   */
  it('serves concurrent callers from one read', async () => {
    const read = vi.fn().mockResolvedValue(space);
    const load = createOfflineDataLoader(read);

    const [first, second] = await Promise.all([load(), load()]);

    expect(read).toHaveBeenCalledOnce();
    expect(first).toBe(space);
    expect(second).toBe(space);
  });

  it('serves a later caller the same read, without going back to the source', async () => {
    const read = vi.fn().mockResolvedValue(space);
    const load = createOfflineDataLoader(read);

    await load();

    expect(await load()).toBe(space);
    expect(read).toHaveBeenCalledOnce();
  });

  // A space that is not there is an answer, not a miss: retrying it every time would turn one 404 into as many
  // reads as the render happens to make.
  it('holds on to "no such space" too', async () => {
    const read = vi.fn().mockResolvedValue(undefined);
    const load = createOfflineDataLoader(read);

    expect(await load()).toBeUndefined();
    expect(await load()).toBeUndefined();
    expect(read).toHaveBeenCalledOnce();
  });
});
