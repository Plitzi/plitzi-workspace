import { describe, it, expect, vi } from 'vitest';

import createStore from './createStore';
import { CANCEL } from '../types';

import type { StoreChange, StoreMiddleware, WriteContext } from '../types';

type AppState = { count: number; ui: { open: boolean; size: number }; tags: string[] };
const initial = (): AppState => ({ count: 0, ui: { open: false, size: 10 }, tags: ['a'] });

describe('beforeChange middleware — transforming writes', () => {
  it('transforms a single-segment write before it commits', () => {
    const double: StoreMiddleware<AppState> = () => ({
      beforeChange: ({ value }) => (typeof value === 'number' ? value * 2 : value)
    });
    const store = createStore<AppState>(initial(), { middlewares: [double] });

    store.setState('count', 5);

    expect(store.getState().count).toBe(10);
  });

  it('transforms a multi-segment write before it commits', () => {
    const bump: StoreMiddleware<AppState> = () => ({
      beforeChange: ({ path, value }) => (path === 'ui.size' ? (value as number) + 1 : value)
    });
    const store = createStore<AppState>(initial(), { middlewares: [bump] });

    store.setState('ui.size', 41);

    expect(store.getState().ui.size).toBe(42);
  });

  it('transforms a whole-state write, seeing the full next state', () => {
    const seen: WriteContext<AppState>[] = [];
    const pin: StoreMiddleware<AppState> = () => ({
      beforeChange: ctx => {
        seen.push(ctx);

        return { ...(ctx.value as AppState), count: 99 };
      }
    });
    const store = createStore<AppState>(initial(), { middlewares: [pin] });

    store.setState(undefined, { count: 1 } as AppState);

    expect(seen[0].path).toBeUndefined();
    expect(store.getState().count).toBe(99);
  });

  it('lets the value through unchanged when the interceptor returns undefined', () => {
    const passthrough: StoreMiddleware<AppState> = () => ({ beforeChange: () => undefined });
    const store = createStore<AppState>(initial(), { middlewares: [passthrough] });

    store.setState('count', 7);

    expect(store.getState().count).toBe(7);
  });

  it('sees the resolved value of a function setter, not the function', () => {
    const seen: unknown[] = [];
    const spy: StoreMiddleware<AppState> = () => ({
      beforeChange: ({ value, prev }) => {
        seen.push({ value, prev });

        return value;
      }
    });
    const store = createStore<AppState>(initial(), { middlewares: [spy] });

    store.setState('count', prev => prev + 3);

    expect(seen).toEqual([{ value: 3, prev: 0 }]);
  });
});

describe('beforeChange middleware — cancelling writes', () => {
  it('cancels a write so nothing commits and no subscriber wakes', () => {
    const guard: StoreMiddleware<AppState> = () => ({
      beforeChange: ({ value }) => ((value as number) > 100 ? CANCEL : value)
    });
    const store = createStore<AppState>(initial(), { middlewares: [guard] });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState('count', 200);

    expect(store.getState().count).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('cancels a multi-segment write', () => {
    const readonly: StoreMiddleware<AppState> = () => ({
      beforeChange: ({ path }) => (path === 'ui.open' ? CANCEL : undefined)
    });
    const store = createStore<AppState>(initial(), { middlewares: [readonly] });

    store.setState('ui.open', true);

    expect(store.getState().ui.open).toBe(false);
  });
});

describe('beforeChange middleware — composition', () => {
  it('runs beforeChange across middlewares in array order, each seeing the previous result', () => {
    const store = createStore<AppState>(initial(), {
      middlewares: [
        () => ({ beforeChange: ({ value }) => (value as number) + 1 }),
        () => ({ beforeChange: ({ value }) => (value as number) * 10 })
      ]
    });

    store.setState('count', 4);

    expect(store.getState().count).toBe(50);
  });

  it('a later middleware can cancel a write an earlier one transformed', () => {
    const store = createStore<AppState>(initial(), {
      middlewares: [
        () => ({ beforeChange: ({ value }) => (value as number) + 1 }),
        () => ({ beforeChange: ({ value }) => ((value as number) > 3 ? CANCEL : value) })
      ]
    });

    store.setState('count', 5);

    expect(store.getState().count).toBe(0);
  });

  it('runs beforeChange before the same middleware would observe via onChange', () => {
    const seen: number[] = [];
    const store = createStore<AppState>(initial(), {
      middlewares: [
        () => ({
          beforeChange: ({ value }) => (value as number) * 2,
          onChange: c => seen.push(c.next.count)
        })
      ]
    });

    store.setState('count', 5);

    expect(seen).toEqual([10]);
  });

  it('runs before subscribeChange observers see the committed change', () => {
    const changes: StoreChange<AppState>[] = [];
    const store = createStore<AppState>(initial(), {
      middlewares: [() => ({ beforeChange: ({ value }) => (value as number) * 2 })]
    });
    store.subscribeChange(c => changes.push(c));

    store.setState('count', 5);

    expect(changes[0].next.count).toBe(10);
  });
});

describe('beforeChange middleware — a custom guard middleware', () => {
  it('blocks forbidden paths and clamps others', () => {
    let isAdmin = false;
    const guard: StoreMiddleware<AppState> = () => ({
      beforeChange: ({ path, value }) => {
        if (path === 'count' && !isAdmin) {
          return CANCEL;
        }

        if (path === 'ui.size') {
          return Math.min(value as number, 100);
        }

        return undefined;
      }
    });
    const store = createStore<AppState>(initial(), { middlewares: [guard] });

    store.setState('count', 5);
    expect(store.getState().count).toBe(0);

    store.setState('ui.size', 999);
    expect(store.getState().ui.size).toBe(100);

    isAdmin = true;
    store.setState('count', 5);
    expect(store.getState().count).toBe(5);
  });
});
