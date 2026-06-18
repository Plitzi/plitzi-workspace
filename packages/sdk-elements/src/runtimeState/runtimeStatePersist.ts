import { persistMiddleware } from '@plitzi/nexus';

import type { PathOf, PersistTarget, StoreMiddleware } from '@plitzi/nexus';
import type { CommonState } from '@plitzi/sdk-shared';

// `schema` is typed required but absent from the initial store value (synced in after mount), so read it as
// possibly-undefined. Returns `false` while `keepState` is off so persist skips entirely.
const storageTarget = (state: CommonState): PersistTarget | false => {
  const settings = (state.schema as CommonState['schema'] | undefined)?.settings;
  if (!settings?.keepState) {
    return false;
  }

  return settings.stateStorage === 'sessionStorage' ? 'session' : 'local';
};

// Persists `runtime.state` to local/session storage (keyed per web), driven reactively by `schema.settings`. Mounted
// in each app's root StoreProvider; `useRuntimeStateManager` re-hydrates it once `keepState` is known.
export const runtimeStatePersist = <TState extends CommonState>(webId: number): StoreMiddleware<TState> =>
  persistMiddleware<TState>({
    key: `plitzi_${webId}_state`,
    // Valid for any CommonState; TS can't prove it through the generic `TState`, so cast.
    paths: ['runtime.state'] as PathOf<TState>[],
    storage: storageTarget
  });
