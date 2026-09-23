import { persistMiddleware } from '@plitzi/nexus';

import type { CommonState } from '../types';
import type { PathOf, PersistStorage, StoreMiddleware } from '@plitzi/nexus';

type AuthSource = { status?: string; isAuthenticated?: boolean; details?: { id?: number | string } };

/** Auth is still finding out who this is: nothing kept can be told apart yet from somebody else's. */
const UNSETTLED = new Set(['init', 'initLoading', 'authenticating']);

/**
 * Who `runtime.state` belongs to.
 *
 * Read from the `auth` source GlobalSources publishes, which every auth provider feeds the same way — so this is the
 * whole vocabulary, whatever a space signs people in with. A space with no accounts at all (no provider, or none of its
 * auth published) has one owner, the browser. Otherwise it is the signed-in account, or the guest.
 */
export type StateOwner = { kind: 'browser' } | { kind: 'guest' } | { kind: 'account'; id: string };

/** `undefined` while auth has not settled: nothing kept can be told apart yet from somebody else's. */
export const stateOwner = (state: CommonState): StateOwner | undefined => {
  // The sources are an open record typed `unknown`; this shape is what GlobalSources publishes under `auth`.
  const auth = state.runtime?.sources.auth as AuthSource | undefined;
  if (!auth || auth.status === undefined) {
    return { kind: 'browser' };
  }

  if (UNSETTLED.has(auth.status)) {
    return undefined;
  }

  return auth.isAuthenticated && auth.details?.id !== undefined
    ? { kind: 'account', id: String(auth.details.id) }
    : { kind: 'guest' };
};

/** How an owner is written on a kept entry. Entries already in browsers carry exactly these strings. */
const ownerKey = (owner: StateOwner): string => {
  switch (owner.kind) {
    case 'account':
      return `user:${owner.id}`;
    case 'guest':
      return 'guest';
    case 'browser':
      return '';
  }
};

/**
 * A storage whose entries remember who wrote them, and that forgets an entry written by somebody else.
 *
 * The key is per space and the storage per browser, so two people signing in on one browser shared one kept state —
 * the dashboard reopened the previous account's workspace, which the new one cannot even see. Signing out does not
 * clear it either, because signing out happens on the sign-in screen, which is another origin with another storage.
 * So the owner travels with the entry: read back by anyone else, it is removed and nothing is restored.
 */
const ownedStorage = (storage: Storage, owner: string): PersistStorage => ({
  getItem: key => {
    const raw = storage.getItem(key);
    if (raw === null) {
      return null;
    }

    try {
      const entry = JSON.parse(raw) as { owner?: unknown; payload?: unknown };
      if (entry.owner === owner && typeof entry.payload === 'string') {
        return entry.payload;
      }
    } catch {
      // Not an entry of this shape at all; it goes the way somebody else's would.
    }

    storage.removeItem(key);

    return null;
  },
  setItem: (key, value) => storage.setItem(key, JSON.stringify({ owner, payload: value })),
  removeItem: key => storage.removeItem(key)
});

const browserStorage = (kind: 'local' | 'session'): Storage | undefined => {
  try {
    return kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
  } catch {
    // A sandboxed frame or a privacy mode throws on access rather than answering `undefined`.
    return undefined;
  }
};

// Persists `runtime.state` to local/session storage (keyed per web), gated reactively by `schema.settings`: while
// `keepState` is off the storage resolver returns `false` and persist skips entirely. `schema` is typed required but
// seeded after mount, so it's read defensively. Mounted in each app's root StoreProvider; the persist middleware
// self-hydrates on its first commit once storage becomes resolvable (i.e. once `keepState` is turned on).
//
// Nothing is restored while a render is still hydrating, and that gate is the whole reason this resolver reads
// `render` at all. What a browser kept from last visit is by definition something the server could not know, so
// putting it into the store during the pass that has to MATCH the server's markup is a guaranteed mismatch — and React
// answers a mismatch by discarding the entire tree it happened in, not the one text node. The dashboard's sidebar was
// the visible version of this: the server rendered the workspace initial as "—" (it has no browser storage) and the
// client rendered "A", and the layout was thrown away and re-rendered on every SSR page load.
//
// The persist middleware runs its restore in a mount effect for exactly this reason, but it ALSO retries on every
// commit — it has to, because the setting that resolves storage arrives after the store does — and the schema is
// seeded during the first render, so the retry fired inside the hydrating pass and defeated the mount effect. Refusing
// a storage until `render.hydrated` closes that door here: the retry then succeeds on the first commit after
// hydration, which is where it was always meant to happen.
//
// Nor is anything restored before auth has settled, for the same reason from the other side: until it knows who this
// is, what was kept cannot be told apart from what somebody else kept (see `ownedStorage`).
export const runtimeStatePersist = <TState extends CommonState>(webId: number): StoreMiddleware<TState> => {
  const persist = persistMiddleware<TState>({
    key: `plitzi_${webId}_state`,
    // `runtime.state` is valid for any CommonState; TS can't prove it through the generic `TState`, so cast.
    paths: ['runtime.state'] as PathOf<TState>[],
    storage: (state: CommonState) => {
      const { schema, render } = state;
      // Only a render that came from SSR waits: a client-only one (the builder, an embed) has no markup to match and
      // restores as soon as the setting says to.
      if (render?.isHydrating && !render.hydrated) {
        return false;
      }

      const settings = (schema as CommonState['schema'] | undefined)?.settings;
      const owner = stateOwner(state);
      if (!settings?.keepState || owner === undefined) {
        return false;
      }

      const storage = browserStorage(settings.stateStorage === 'sessionStorage' ? 'session' : 'local');

      return storage ? ownedStorage(storage, ownerKey(owner)) : false;
    }
  });

  return api => {
    const handlers = persist(api);
    const initial = api.getState().runtime?.state;
    let owner = stateOwner(api.getState());

    return {
      ...handlers,
      /**
       * An account changing under a running page takes its state with it.
       *
       * The storage forgets another owner's entry, but the page still HOLDS the previous account's state in memory,
       * and the next write would file it under the new one. So it goes back to what the space starts with — before the
       * write that follows, which is why this runs first.
       *
       * Only when the state belonged to an ACCOUNT: another one taking over, or it signing out. The browser and the guest
       * are nobody in particular, so there is nobody to protect the state from — a guest signing in is the same person,
       * and what they were doing is theirs. The sign-in screen holds the address to send them back to in this state,
       * and clearing it as their session arrived sent them to "you are signed in" instead, whenever their account
       * details landed before the page read it.
       */
      onChange: change => {
        const previous = owner;
        const next = stateOwner(api.getState());
        // Recorded before the reset below, whose own commit comes back through here and must find nothing to do.
        if (next !== undefined) {
          owner = next;
        }

        if (previous?.kind === 'account' && next !== undefined && ownerKey(next) !== ownerKey(previous)) {
          // `runtime.state` is valid for any CommonState; TS can't prove it through the generic `TState`, so cast.
          api.setState('runtime.state' as PathOf<TState>, initial as never);
        }

        handlers?.onChange?.(change);
      }
    };
  };
};
