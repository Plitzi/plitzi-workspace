import { persistMiddleware } from '@plitzi/nexus';

import type { CommonState } from '../types';
import type { PathOf, StoreMiddleware } from '@plitzi/nexus';

// Persists `runtime.state` to local/session storage (keyed per web), gated reactively by `schema.settings`: while
// `keepState` is off the storage resolver returns `false` and persist skips entirely. `schema` is typed required but
// seeded after mount, so it's read defensively. Mounted in each app's root StoreProvider; the persist middleware
// self-hydrates on its first commit once storage becomes resolvable (i.e. once `keepState` is turned on).
export const runtimeStatePersist = <TState extends CommonState>(webId: number): StoreMiddleware<TState> =>
  persistMiddleware<TState>({
    key: `plitzi_${webId}_state`,
    // `runtime.state` is valid for any CommonState; TS can't prove it through the generic `TState`, so cast.
    paths: ['runtime.state'] as PathOf<TState>[],
    storage: ({ schema }: CommonState) => {
      const settings = (schema as CommonState['schema'] | undefined)?.settings;
      if (!settings?.keepState) {
        return false;
      }

      return settings.stateStorage === 'sessionStorage' ? 'session' : 'local';
    }
  });
