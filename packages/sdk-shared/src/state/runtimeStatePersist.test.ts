import { createStore } from '@plitzi/nexus';

import { runtimeStatePersist } from './runtimeStatePersist';

import type { CommonState } from '../types';
import type { Schema } from '../types';

/**
 * The invariant this file exists for: nothing a browser kept comes back while a render is still hydrating.
 *
 * It is not a cosmetic ordering preference. Restoring during the pass that has to match the server's markup is a
 * hydration mismatch, and React answers one by discarding the whole tree it happened in — the dashboard's entire
 * sidebar, for a workspace initial. The `deferHydrate` store option is what the real StoreProvider uses; the manual
 * `hydrate()` calls below stand in for its mount effect.
 */

const KEY = 'plitzi_42_state';

const kept = { workspace: { id: 3, name: 'Acme' } };

const settings = (keepState: boolean, stateStorage?: 'localStorage' | 'sessionStorage') =>
  ({ settings: { keepState, stateStorage } }) as unknown as Schema;

const build = (seed: Partial<CommonState>) =>
  createStore<CommonState>(seed as CommonState, {
    middlewares: [runtimeStatePersist<CommonState>(42)],
    deferHydrate: true
  });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(KEY, JSON.stringify({ version: 0, state: { 'runtime.state': kept } }));
});

describe('runtimeStatePersist', () => {
  it('restores what was kept, once the app has mounted', () => {
    const store = build({ schema: settings(true), render: { isHydrating: false } });
    store.hydrate?.();

    expect(store.getState().runtime?.state).toEqual(kept);
  });

  it('restores nothing when the space does not ask it to', () => {
    const store = build({ schema: settings(false), render: { isHydrating: false } });
    store.hydrate?.();

    expect(store.getState().runtime?.state).toBeUndefined();
  });

  /**
   * The bug this gate was added for: the schema is seeded during the FIRST render, and the persist middleware retries
   * its restore on every commit — so the retry landed inside the hydrating pass and put a value on screen that the
   * server could not have rendered.
   */
  it('restores nothing on a commit that happens while the render is still hydrating', () => {
    const store = build({ render: { isHydrating: true, hydrated: false } });

    // Exactly what `SchemaContextProvider` does, and it used to be enough to trigger the restore.
    store.setState('schema', settings(true));

    expect(store.getState().runtime?.state).toBeUndefined();
  });

  it('restores on the first commit after hydration finishes', () => {
    const store = build({ render: { isHydrating: true, hydrated: false } });
    store.setState('schema', settings(true));
    store.hydrate?.();

    expect(store.getState().runtime?.state).toBeUndefined();

    // What `AppMain` publishes from its mount effect. The middleware's own retry picks it up from here.
    store.setState('render.hydrated', true);

    expect(store.getState().runtime?.state).toEqual(kept);
  });

  /** A client-only render — the builder, an embed — has no markup to match and must not wait for anything. */
  it('does not make a client-only render wait', () => {
    const store = build({ render: { isHydrating: false, hydrated: false } });
    store.setState('schema', settings(true));

    expect(store.getState().runtime?.state).toEqual(kept);
  });

  it('honours the storage the space chose', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ version: 0, state: { 'runtime.state': { from: 'session' } } }));

    const store = build({ schema: settings(true, 'sessionStorage'), render: { isHydrating: false } });
    store.hydrate?.();

    expect(store.getState().runtime?.state).toEqual({ from: 'session' });
  });
});
