import { persistMiddleware } from '@plitzi/nexus';

import {
  clearPaintedEntry,
  paintedKeys,
  paintedStateCookieName,
  pickPainted,
  readPaintedEntry,
  writePaintedEntry
} from './paintedState';
import { pConsole } from '../devTools/utils/PlitziConsole';

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

/**
 * `undefined` while nobody can say yet: nothing kept can be told apart from somebody else's.
 *
 * That includes the moment before the `auth` source EXISTS. GlobalSources publishes it for every space — `{}` for one
 * with no accounts, a `status` for one with a provider — but only once it mounts, and the store is asked for its
 * storage before that. Read as "the browser" there, the first read of every visit found the guest's entry, called it
 * somebody else's, and deleted it: a space with `keepState` kept nothing past a reload.
 */
export const stateOwner = (state: CommonState): StateOwner | undefined => {
  // The sources are an open record typed `unknown`; this shape is what GlobalSources publishes under `auth`.
  const auth = state.runtime?.sources.auth as AuthSource | undefined;
  if (!auth) {
    return undefined;
  }

  if (auth.status === undefined) {
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

/** The one path this module keeps. */
const KEPT_PATH = 'runtime.state';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const omitKeys = (from: Record<string, unknown>, keys: ReadonlySet<string>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(from).filter(([key]) => !keys.has(key)));

const pickKeys = (from: unknown, keys: ReadonlySet<string>): Record<string, unknown> =>
  isRecord(from) ? Object.fromEntries(Object.entries(from).filter(([key]) => keys.has(key))) : {};

/** `schema` is typed required but seeded after mount, so it is read defensively. */
const schemaSettings = (state: CommonState): CommonState['schema']['settings'] | undefined =>
  (state.schema as CommonState['schema'] | undefined)?.settings;

/** The keys a space declared never to keep. */
const transientKeys = (settings: Pick<CommonState['schema']['settings'], 'transientState'> | undefined): Set<string> =>
  new Set((settings?.transientState ?? []).filter((key): key is string => typeof key === 'string' && key !== ''));

const browserStorage = (kind: 'local' | 'session'): Storage | undefined => {
  try {
    return kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
  } catch {
    // A sandboxed frame or a privacy mode throws on access rather than answering `undefined`.
    return undefined;
  }
};

/**
 * Keeps the cookie of `settings.paintedState` (see `paintedState.ts`) in step with `runtime.state`.
 *
 * Under the same gates as the restore — after hydration, with `keepState` on, once auth has said who this is — and for
 * the same reason as the owner on a kept entry: the first time those hold, an entry somebody else wrote is removed, and
 * the values the page rendered with from it are dropped. After that, a change to a declared key rewrites the entry;
 * nothing else touches the cookie.
 */
const paintedSync = <TState extends CommonState>(
  api: { getState: () => TState; setState: (path: PathOf<TState>, value: never) => void },
  webId: number
): (() => void) => {
  const name = paintedStateCookieName(webId, typeof window === 'undefined' ? undefined : window.location.host);
  let checked = false;
  let written: string | undefined;

  return () => {
    const state = api.getState();
    if (typeof document === 'undefined' || (state.render?.isHydrating && !state.render.hydrated)) {
      return;
    }

    const settings = schemaSettings(state);
    const keys = paintedKeys(settings);
    const current = stateOwner(state);
    if (!settings?.keepState || keys.size === 0 || current === undefined) {
      return;
    }

    const owner = ownerKey(current);
    const kept = state.runtime?.state;
    if (!checked) {
      checked = true;
      const entry = readPaintedEntry(name);
      if (entry && entry.owner !== owner) {
        clearPaintedEntry(name);
        if (isRecord(kept) && [...keys].some(key => key in kept)) {
          // `runtime.state` is valid for any CommonState; TS can't prove it through the generic `TState`, so cast.
          // Its commit comes back through here, and finds the entry gone.
          api.setState('runtime.state' as PathOf<TState>, omitKeys(kept, keys) as never);

          return;
        }
      }

      written = entry?.owner === owner ? JSON.stringify(pickPainted(entry.values, keys)) : undefined;
    }

    const values = pickPainted(kept, keys);
    const serialized = JSON.stringify(values);
    if (serialized === written) {
      return;
    }

    written = serialized;
    if (Object.keys(values).length === 0) {
      clearPaintedEntry(name);

      return;
    }

    if (writePaintedEntry(name, { owner, values }) === 'too-large') {
      pConsole.warning(
        'store',
        `settings.paintedState holds more than a cookie can carry — the first paint uses the space's defaults for ${[...keys].join(', ')}. Declare only what the first paint shows.`,
        { storeName: 'runtime', path: 'runtime.state', prev: undefined, next: values }
      );
    }
  };
};

// Persists `runtime.state` to local/session storage (keyed per web), gated reactively by `schema.settings`: while
// `keepState` is off the storage resolver returns `false` and persist skips entirely. Mounted in each app's root StoreProvider; the persist middleware
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
    paths: [KEPT_PATH] as PathOf<TState>[],
    /**
     * The space's transient keys stay out of what is written — and out of what is read back, so an entry kept before a
     * key was declared transient does not bring it back — while the values they hold now survive the restore, which
     * lands late (after hydration, once auth settles) and would otherwise put `runtime.state` back whole over them.
     */
    partializePath: (_path, value, state) =>
      isRecord(value) ? omitKeys(value, transientKeys(schemaSettings(state))) : value,
    mergePath: (_path, persisted, current, state) => {
      const transient = transientKeys(schemaSettings(state));

      return transient.size > 0 && isRecord(persisted)
        ? { ...omitKeys(persisted, transient), ...pickKeys(current, transient) }
        : persisted;
    },
    storage: (state: CommonState) => {
      const { render } = state;
      // Only a render that came from SSR waits: a client-only one (the builder, an embed) has no markup to match and
      // restores as soon as the setting says to.
      if (render?.isHydrating && !render.hydrated) {
        return false;
      }

      const settings = schemaSettings(state);
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
    const painted = paintedSync(api, webId);

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
          // Without the painted keys: what the page STARTED with may have come from the previous account's cookie.
          const fresh = isRecord(initial) ? omitKeys(initial, paintedKeys(schemaSettings(api.getState()))) : initial;
          // `runtime.state` is valid for any CommonState; TS can't prove it through the generic `TState`, so cast.
          api.setState('runtime.state' as PathOf<TState>, fresh as never);
        }

        handlers?.onChange?.(change);
        painted();
      }
    };
  };
};
