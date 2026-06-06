import { describe, it, expect, vi } from 'vitest';

import { loggerMiddleware } from './loggerMiddleware';
import createStore from '../createStore/createStore';

import type { StoreError, StoreMiddleware } from '../types';

type AppState = { count: number };
const initial = (): AppState => ({ count: 0 });

// A middleware whose handlers throw, to drive the error pipeline.
const failing =
  (where: 'beforeChange' | 'onChange'): StoreMiddleware<AppState> =>
  () =>
    where === 'beforeChange'
      ? {
          beforeChange: () => {
            throw new Error('beforeChange boom');
          }
        }
      : {
          onChange: () => {
            throw new Error('onChange boom');
          }
        };

describe('middleware error handling', () => {
  it('routes an onChange failure to the logger errorSink instead of throwing', () => {
    const failures: StoreError<AppState>[] = [];
    const store = createStore<AppState>(initial(), {
      middlewares: [loggerMiddleware({ sink: () => {}, errorSink: f => failures.push(f) }), failing('onChange')]
    });

    expect(() => store.setState('count', 1)).not.toThrow();
    expect(store.getState().count).toBe(1); // the write still committed

    expect(failures).toHaveLength(1);
    expect(failures[0].phase).toBe('onChange');
    expect(failures[0].path).toBe('count');
    expect((failures[0].error as Error).message).toBe('onChange boom');
  });

  it('routes a beforeChange failure to the logger and fails the write closed', () => {
    const failures: StoreError<AppState>[] = [];
    const store = createStore<AppState>(initial(), {
      middlewares: [loggerMiddleware({ sink: () => {}, errorSink: f => failures.push(f) }), failing('beforeChange')]
    });

    expect(() => store.setState('count', 1)).not.toThrow();
    expect(store.getState().count).toBe(0); // a crashed interceptor cancels the write

    expect(failures).toHaveLength(1);
    expect(failures[0].phase).toBe('beforeChange');
  });

  it('does not let one failing onChange starve the other change observers', () => {
    const seen: number[] = [];
    const observer: StoreMiddleware<AppState> = () => ({ onChange: c => seen.push(c.next.count) });
    const store = createStore<AppState>(initial(), {
      middlewares: [loggerMiddleware({ sink: () => {}, errorSink: () => {} }), failing('onChange'), observer]
    });

    store.setState('count', 5);

    expect(seen).toEqual([5]); // the observer after the failing middleware still ran
  });

  it('re-throws when no error handler (logger) is registered, so failures are never swallowed', () => {
    const store = createStore<AppState>(initial());
    store.subscribeChange(() => {
      throw new Error('unhandled');
    });

    expect(() => store.setState('count', 1)).toThrow('unhandled');
  });

  it('reports a middleware failure on a scoped child through the child logger when the parent changes', () => {
    const parent = createStore<AppState>(initial());
    const failures: StoreError<AppState>[] = [];
    const child = createStore<AppState>(
      {},
      {
        parent,
        middlewares: [loggerMiddleware({ sink: () => {}, errorSink: f => failures.push(f) }), failing('onChange')]
      }
    );

    expect(() => parent.setState('count', 3)).not.toThrow();
    expect(child.getState().count).toBe(3);

    expect(failures).toHaveLength(1);
    expect(failures[0].phase).toBe('onChange');
  });

  it('defaults the error sink to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createStore<AppState>(initial(), {
      middlewares: [loggerMiddleware({ sink: () => {} }), failing('onChange')]
    });

    store.setState('count', 1);

    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
