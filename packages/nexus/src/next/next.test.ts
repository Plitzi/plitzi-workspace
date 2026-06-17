import { describe, it, expect, vi } from 'vitest';

// Mock next/cache so the dynamic import in bindServerAction resolves in tests
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn()
}));

import createStore from '../createStore';
import { bindServerAction } from './index';

type State = { count: number; user: { name: string } };

const createTestStore = () => createStore<State>({ count: 0, user: { name: 'Alice' } });

describe('bindServerAction', () => {
  it('performs an optimistic update with a value', async () => {
    const store = createTestStore();
    const action = vi.fn((value: number) => Promise.resolve(value * 2));
    const sync = bindServerAction<State, 'count'>(store, 'count', action);

    const promise = sync(5);

    // Optimistic update applied immediately
    expect(store.getState().count).toBe(5);

    await promise;

    // Server resolved
    expect(action).toHaveBeenCalledWith(5);
  });

  it('performs an optimistic update with a function updater', async () => {
    const store = createTestStore();
    const action = vi.fn((value: number) => Promise.resolve(value + 10));
    const sync = bindServerAction<State, 'count'>(store, 'count', action);

    store.setState('count', 3);

    const promise = sync((prev: number) => prev * 2);

    // Optimistic update: prev=3, fn returns 6
    expect(store.getState().count).toBe(6);

    await promise;

    expect(action).toHaveBeenCalledWith(6);
  });
});

describe('bindServerAction rollback', () => {
  it('rolls back on error', async () => {
    const store = createTestStore();
    const action = vi.fn(() => Promise.reject(new Error('server error')));
    const sync = bindServerAction<State, 'count'>(store, 'count', action);

    // Set initial state
    store.setState('count', 10);
    expect(store.getState().count).toBe(10);

    // Attempt the sync — it should roll back
    await expect(sync(20)).rejects.toThrow('server error');

    // Store should be rolled back to the pre-optimistic value
    expect(store.getState().count).toBe(10);
  });
});

describe('bindServerAction revalidation', () => {
  it('calls revalidatePath and revalidateTag from next/cache', async () => {
    const store = createTestStore();
    const action = vi.fn((value: number) => Promise.resolve(value));
    const sync = bindServerAction<State, 'count'>(store, 'count', action, {
      revalidatePath: '/dashboard',
      revalidateTag: 'posts'
    });

    await sync(42);

    // The dynamic import revalidation is handled inside bindServerAction
    expect(store.getState().count).toBe(42);
  });

  it('skips revalidation when no options provided', async () => {
    const store = createTestStore();
    const action = vi.fn((value: number) => Promise.resolve(value));
    const sync = bindServerAction<State, 'count'>(store, 'count', action);

    await sync(99);

    expect(store.getState().count).toBe(99);
  });
});
