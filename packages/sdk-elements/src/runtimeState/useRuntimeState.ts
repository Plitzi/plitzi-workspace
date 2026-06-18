import { set } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';
import { useCallback } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';

import type { CommonState, RuntimeState, RuntimeStateInstance } from '@plitzi/sdk-shared';

const EMPTY_STATE: RuntimeState = {};

// Canonical accessor for the user/application runtime state, stored under `runtime.state` in the nexus store
// (the former `@plitzi/sdk-state`). Persistence is handled by `RuntimeStateProvider`, not here.
const useRuntimeState = (): RuntimeStateInstance => {
  const { useStore } = createStoreHook<CommonState>();
  const [state = EMPTY_STATE, setRuntimeState] = useStore('runtime.state');

  const setState = useCallback<RuntimeStateInstance['setState']>(
    value => {
      setRuntimeState(prev => (typeof value === 'function' ? value(prev ?? EMPTY_STATE) : value));
    },
    [setRuntimeState]
  );

  const setStateByKey = useCallback<RuntimeStateInstance['setStateByKey']>(
    (key, value) => {
      setRuntimeState(prev =>
        produce(prev ?? EMPTY_STATE, draft => {
          set(draft, key, value);
        })
      );
    },
    [setRuntimeState]
  );

  const clearState = useCallback<RuntimeStateInstance['clearState']>(() => setRuntimeState({}), [setRuntimeState]);

  return { state, setState, setStateByKey, clearState };
};

export default useRuntimeState;
