import { beforeEach, describe, expect, it } from 'vitest';

import { createStore } from '@plitzi/nexus';

import { paintedEntryFromCookies, paintedStateCookieName } from './paintedState';
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

const settings = (keepState: boolean, stateStorage?: 'localStorage' | 'sessionStorage', transientState?: string[]) =>
  ({ settings: { keepState, stateStorage, transientState } }) as unknown as Schema;

/** What the middleware writes: the persist envelope, filed under whoever wrote it. */
const entry = (owner: string, state: unknown): string =>
  JSON.stringify({ owner, payload: JSON.stringify({ version: 0, state: { 'runtime.state': state } }) });

const signedIn = (id: number) => ({ status: 'authenticated', isAuthenticated: true, details: { id } });

/**
 * A store as the app has it once GlobalSources has mounted. A space with no accounts publishes `auth` as `{}`, which is
 * what says its one owner is the browser; a seed that brings its own `runtime` replaces it.
 */
const build = (seed: Partial<CommonState>) =>
  createStore<CommonState>(
    { runtime: { sources: { auth: {} } }, ...seed },
    {
      middlewares: [runtimeStatePersist<CommonState>(42)],
      deferHydrate: true
    }
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // A space with no accounts: its one owner is the browser, `''`.
  localStorage.setItem(KEY, entry('', kept));
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
    sessionStorage.setItem(KEY, entry('', { from: 'session' }));

    const store = build({ schema: settings(true, 'sessionStorage'), render: { isHydrating: false } });
    store.hydrate?.();

    expect(store.getState().runtime?.state).toEqual({ from: 'session' });
  });

  /**
   * Two people on one browser. The key is per space, so the dashboard reopened the previous account's workspace — one
   * the new account cannot see — and signing out never cleared it: that happens on the sign-in screen, another origin.
   */
  describe('whose state it is', () => {
    const withAuth = (auth: Record<string, unknown>) =>
      build({ schema: settings(true), render: { isHydrating: false }, runtime: { sources: { auth } } });

    it('restores nothing until auth knows who this is, then restores what that account kept', () => {
      localStorage.setItem(KEY, entry('user:7', kept));
      const store = withAuth({ status: 'init', isAuthenticated: false });
      store.hydrate?.();

      expect(store.getState().runtime?.state).toBeUndefined();

      store.setState('runtime.sources.auth', signedIn(7));

      expect(store.getState().runtime?.state).toEqual(kept);
    });

    it('forgets what another account kept instead of restoring it', () => {
      localStorage.setItem(KEY, entry('user:7', kept));
      const store = withAuth(signedIn(9));
      store.hydrate?.();

      expect(store.getState().runtime?.state).toBeUndefined();
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('forgets an entry that does not say whose it is', () => {
      localStorage.setItem(KEY, JSON.stringify({ version: 0, state: { 'runtime.state': kept } }));
      const store = withAuth(signedIn(7));
      store.hydrate?.();

      expect(store.getState().runtime?.state).toBeUndefined();
    });

    it('drops the state it holds when the account changes under it, and keeps the next one under the new owner', () => {
      localStorage.setItem(KEY, entry('user:7', kept));
      const store = withAuth(signedIn(7));
      store.hydrate?.();

      expect(store.getState().runtime?.state).toEqual(kept);

      store.setState('runtime.sources.auth', signedIn(9));

      expect(store.getState().runtime?.state).toBeUndefined();

      store.setState('runtime.state', { workspace: { id: 12 } });

      expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toMatchObject({ owner: 'user:9' });
    });

    const guest = { status: 'unauthenticated', isAuthenticated: false };

    // The sign-in screen keeps the address to send somebody back to in this state. Cleared as their session arrived,
    // it sent them to "you are signed in" whenever their account details landed before the page read it.
    it.each([true, false])('keeps what a guest was doing when they sign in (keepState %s)', keepState => {
      const store = build({
        schema: settings(keepState),
        render: { isHydrating: false },
        runtime: { sources: { auth: guest } }
      });
      store.hydrate?.();
      store.setState('runtime.state', { redirect: 'https://app.plitzi.com/spaces' });

      store.setState('runtime.sources.auth', signedIn(7));

      expect(store.getState().runtime?.state).toEqual({ redirect: 'https://app.plitzi.com/spaces' });
    });

    /**
     * The first read of every visit happens before GlobalSources has published `auth` at all. Taken for the browser,
     * that read found the guest's entry, called it somebody else's and deleted it — `keepState` kept nothing past a
     * reload. Until the source exists the owner is unknown, and an unknown owner reads nothing and deletes nothing.
     */
    it('keeps a guest entry through the reads that happen before auth is published', () => {
      localStorage.setItem(KEY, entry('guest', kept));
      const store = build({ schema: settings(true), render: { isHydrating: false }, runtime: { sources: {} } });
      store.hydrate?.();
      store.setState('schema', settings(true));

      expect(localStorage.getItem(KEY)).not.toBeNull();

      store.setState('runtime.sources.auth', { status: 'init', isAuthenticated: false });
      store.setState('runtime.sources.auth', guest);

      expect(store.getState().runtime?.state).toEqual(kept);
    });

    // Auth published after the page mounted: until then the owner is unknown, which takes nothing from anybody.
    it('keeps the state when auth arrives after the page did', () => {
      const store = build({ schema: settings(false), render: { isHydrating: false }, runtime: { sources: {} } });
      store.hydrate?.();
      store.setState('runtime.state', { redirect: 'https://app.plitzi.com/spaces' });

      store.setState('runtime.sources.auth', signedIn(7));

      expect(store.getState().runtime?.state).toEqual({ redirect: 'https://app.plitzi.com/spaces' });
    });

    it('drops the state of an account that signs out', () => {
      const store = withAuth(signedIn(7));
      store.hydrate?.();
      store.setState('runtime.state', kept);

      store.setState('runtime.sources.auth', guest);

      expect(store.getState().runtime?.state).toBeUndefined();
    });
  });

  /**
   * State a space declares transient: a demo, a panel left open — things that must start fresh on every visit while the
   * rest of the page keeps what it kept. Restoring lands late (after hydration, after auth), so "start fresh" also means
   * a value set before the restore is not undone by it.
   */
  describe('transient keys', () => {
    const transient = (hydrating = false) =>
      build({
        schema: settings(true, undefined, ['demo']),
        render: hydrating ? { isHydrating: true, hydrated: false } : { isHydrating: false }
      });

    const stored = () => {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { payload?: string };

      return (JSON.parse(raw.payload ?? '{}') as { state?: Record<string, unknown> }).state?.['runtime.state'];
    };

    it('does not write them', () => {
      const store = transient();
      store.hydrate?.();
      store.setState('runtime.state', { ...kept, demo: 'rose' });

      expect(stored()).toEqual(kept);
      expect(store.getState().runtime?.state).toEqual({ ...kept, demo: 'rose' });
    });

    it('does not bring back one kept before it was declared transient', () => {
      localStorage.setItem(KEY, entry('', { ...kept, demo: 'rose' }));
      const store = transient();
      store.hydrate?.();

      expect(store.getState().runtime?.state).toEqual(kept);
    });

    it('keeps a value set before the rest is restored', () => {
      const store = transient(true);
      store.setState('runtime.state', { demo: 'teal' });
      store.hydrate?.();

      store.setState('render.hydrated', true);

      expect(store.getState().runtime?.state).toEqual({ ...kept, demo: 'teal' });
    });

    it('keeps everything else as before', () => {
      localStorage.setItem(KEY, entry('', { ...kept, other: 1 }));
      const store = transient();
      store.hydrate?.();

      expect(store.getState().runtime?.state).toEqual({ ...kept, other: 1 });
    });
  });

  /**
   * The keys a space declares its first paint depends on: kept in a cookie as well, which the server renders with. The
   * page starts from those values (the SDK's `state`), so what matters here is that the cookie follows the state — and
   * that nothing somebody else wrote is ever left painted.
   */
  describe('painted keys', () => {
    const NAME = paintedStateCookieName(42, window.location.host);

    const painted = (keepState = true) =>
      ({ settings: { keepState, paintedState: ['toolPick', 'name'] } }) as unknown as Schema;

    const cookie = () => paintedEntryFromCookies(document.cookie, NAME);

    const writeCookie = (owner: string, values: Record<string, unknown>) => {
      document.cookie = `${NAME}=${encodeURIComponent(JSON.stringify({ owner, values }))};path=/`;
    };

    beforeEach(() => {
      document.cookie = `${NAME}=;path=/;max-age=0`;
      localStorage.removeItem(KEY);
    });

    it('writes the declared keys, under whoever the state belongs to, and nothing else', () => {
      const store = build({ schema: painted(), render: { isHydrating: false } });
      store.hydrate?.();
      store.setState('runtime.state', { toolPick: 'star', name: 'Ada', filter: 'open' });

      expect(cookie()).toEqual({ owner: '', values: { toolPick: 'star', name: 'Ada' } });
    });

    it('rewrites it when a declared key changes', () => {
      const store = build({ schema: painted(), render: { isHydrating: false } });
      store.hydrate?.();
      store.setState('runtime.state', { toolPick: 'star' });
      store.setState('runtime.state.toolPick', 'hexagon');

      expect(cookie()?.values).toEqual({ toolPick: 'hexagon' });
    });

    it('writes nothing while the render is still hydrating', () => {
      const store = build({ schema: painted(), render: { isHydrating: true, hydrated: false } });
      store.setState('runtime.state', { toolPick: 'star' });

      expect(cookie()).toBeUndefined();

      store.setState('render.hydrated', true);

      expect(cookie()?.values).toEqual({ toolPick: 'star' });
    });

    it('writes nothing when the space does not keep state', () => {
      const store = build({ schema: painted(false), render: { isHydrating: false } });
      store.hydrate?.();
      store.setState('runtime.state', { toolPick: 'star' });

      expect(cookie()).toBeUndefined();
    });

    it('removes the cookie once no declared key holds a value', () => {
      const store = build({ schema: painted(), render: { isHydrating: false } });
      store.hydrate?.();
      store.setState('runtime.state', { toolPick: 'star' });
      store.setState('runtime.state', { filter: 'open' });

      expect(cookie()).toBeUndefined();
    });

    /**
     * The server cannot tell whose the cookie is — for a space with its own sign-in, only the browser settles that. So
     * the page may START with somebody else's values; the first moment it knows, they go, with the cookie.
     */
    it('drops what the page started with from somebody else’s cookie', () => {
      writeCookie('user:7', { toolPick: 'star' });
      const store = build({
        schema: painted(),
        render: { isHydrating: false },
        runtime: { sources: { auth: signedIn(9) }, state: { toolPick: 'star', filter: 'open' } }
      });
      store.hydrate?.();
      store.setState('schema', painted());

      expect(store.getState().runtime?.state).toEqual({ filter: 'open' });
      expect(cookie()).toBeUndefined();
    });

    it('does not bring the previous account’s painted values back when the account changes', () => {
      writeCookie('user:7', { toolPick: 'star' });
      const store = build({
        schema: painted(),
        render: { isHydrating: false },
        runtime: { sources: { auth: signedIn(7) }, state: { toolPick: 'star', workspace: 3 } }
      });
      store.hydrate?.();

      store.setState('runtime.sources.auth', signedIn(9));

      expect(store.getState().runtime?.state).toEqual({ workspace: 3 });
    });

    it('removes the cookie rather than write one over the budget', () => {
      writeCookie('', { toolPick: 'star' });
      const store = build({ schema: painted(), render: { isHydrating: false } });
      store.hydrate?.();
      store.setState('runtime.state', { name: 'x'.repeat(4000) });

      expect(cookie()).toBeUndefined();
    });
  });
});
