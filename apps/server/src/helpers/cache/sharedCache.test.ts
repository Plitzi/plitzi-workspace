import { describe, expect, it, vi } from 'vitest';

import { createMemoryPubSub } from '@plitzi/sdk-kernel/pubsub';

import { createCacheInvalidator, shareCache } from './sharedCache';

import type { CacheManager } from '../../types';
import type { SharedPageStore } from '../../types';

const manager = () => {
  const invalidate = vi.fn<CacheManager['invalidate']>(() => 1);
  const clear = vi.fn<CacheManager['clear']>();

  return { invalidate, clear, size: 0 } satisfies CacheManager;
};

const store = () => {
  const invalidate = vi.fn<SharedPageStore['invalidate']>(() => Promise.resolve(0));
  const pages: SharedPageStore = {
    get: () => Promise.resolve(undefined),
    set: () => Promise.resolve(),
    invalidate
  };

  return { pages, invalidate };
};

/** Two replicas of one deployment: each its own cache, one bus between them. */
const replicas = async (pages?: SharedPageStore) => {
  const bus = createMemoryPubSub();
  const [a, b] = [manager(), manager()];
  const sharedA = shareCache(a, { bus, store: pages });
  const sharedB = shareCache(b, { bus, store: pages });
  await Promise.all([sharedA.ready, sharedB.ready]);

  return { a, b, sharedA, sharedB, bus };
};

describe('a cache several replicas share', () => {
  // A publish lands on one replica; without the bus the others served the old page until it expired.
  it('drops on every replica what one of them is told to', async () => {
    const { a, b, sharedA } = await replicas();

    sharedA.cache.invalidate({ spaceId: 7, environment: 'production' });
    await vi.waitFor(() => {
      expect(b.invalidate).toHaveBeenCalledWith({ spaceId: 7, environment: 'production' });
    });

    expect(a.invalidate).toHaveBeenCalledOnce();
  });

  it('clears every replica when one is cleared', async () => {
    const { b, sharedA } = await replicas();

    sharedA.cache.clear();
    await vi.waitFor(() => {
      expect(b.clear).toHaveBeenCalledOnce();
    });
  });

  it('drops the pages of the store they share once, from the replica that was told', async () => {
    const { pages, invalidate } = store();
    const { sharedA } = await replicas(pages);

    sharedA.cache.invalidate({ spaceId: 7 });
    await vi.waitFor(() => {
      expect(invalidate).toHaveBeenCalledOnce();
    });
    expect(invalidate).toHaveBeenCalledWith({ spaceId: 7 });
  });

  it('stops hearing the bus once closed', async () => {
    const { b, sharedA, sharedB } = await replicas();
    await sharedB.close();

    sharedA.cache.invalidate({ spaceId: 7 });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(b.invalidate).not.toHaveBeenCalled();
  });

  // The API writes a space without serving its pages: it says the invalidation without a cache of its own.
  it('is invalidated from a process that serves no pages', async () => {
    const { a, b, bus } = await replicas();

    await createCacheInvalidator({ bus }).invalidate({ spaceId: 9 });

    await vi.waitFor(() => {
      expect(a.invalidate).toHaveBeenCalledWith({ spaceId: 9 });
      expect(b.invalidate).toHaveBeenCalledWith({ spaceId: 9 });
    });
  });
});
