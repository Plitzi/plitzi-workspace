import { persistMiddleware } from '@plitzi/nexus';

import type { CommonState } from '../types';
import type { PathOf, StoreMiddleware } from '@plitzi/nexus';

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
export const runtimeStatePersist = <TState extends CommonState>(webId: number): StoreMiddleware<TState> =>
  persistMiddleware<TState>({
    key: `plitzi_${webId}_state`,
    // `runtime.state` is valid for any CommonState; TS can't prove it through the generic `TState`, so cast.
    paths: ['runtime.state'] as PathOf<TState>[],
    storage: ({ schema, render }: CommonState) => {
      // Only a render that came from SSR waits: a client-only one (the builder, an embed) has no markup to match and
      // restores as soon as the setting says to.
      if (render?.isHydrating && !render.hydrated) {
        return false;
      }

      const settings = (schema as CommonState['schema'] | undefined)?.settings;
      if (!settings?.keepState) {
        return false;
      }

      return settings.stateStorage === 'sessionStorage' ? 'session' : 'local';
    }
  });
