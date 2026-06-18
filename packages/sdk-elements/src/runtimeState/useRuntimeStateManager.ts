import { useCallback, useEffect, useMemo, useRef } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';

import { writeRuntimeStateKey } from './writeRuntimeStateKey';

import type { CommonState, RuntimeState, RuntimeStateInstance } from '@plitzi/sdk-shared';

const EMPTY_STATE: RuntimeState = {};

export type RuntimeStateManagerOptions = {
  state?: RuntimeState;
  onInit?: (instance: RuntimeStateInstance) => void;
};

// Owns `runtime.state`: seeds the host-provided initial state and exposes the instance to external hosts via `onInit`.
// Persistence (read + write) lives entirely in the root `persistMiddleware`.
const useRuntimeStateManager = ({ state: stateProp, onInit }: RuntimeStateManagerOptions): RuntimeStateInstance => {
  const { useStore } = createStoreHook<CommonState>();
  const [state = EMPTY_STATE, setRuntimeState] = useStore('runtime.state');

  const setState = useCallback<RuntimeStateInstance['setState']>(
    value => setRuntimeState(prev => (typeof value === 'function' ? value(prev ?? EMPTY_STATE) : value)),
    [setRuntimeState]
  );

  const setStateByKey = useCallback<RuntimeStateInstance['setStateByKey']>(
    (key, value) => setRuntimeState(prev => writeRuntimeStateKey(prev, key, value)),
    [setRuntimeState]
  );

  const clearState = useCallback<RuntimeStateInstance['clearState']>(
    () => setRuntimeState(EMPTY_STATE),
    [setRuntimeState]
  );

  const seedRef = useRef(false);
  useEffect(() => {
    if (seedRef.current) {
      setRuntimeState(stateProp ?? EMPTY_STATE);
    } else {
      seedRef.current = true;
      if (stateProp) {
        setRuntimeState(stateProp);
      }
    }
  }, [stateProp, setRuntimeState]);

  const instance = useMemo<RuntimeStateInstance>(
    () => ({ state, setState, setStateByKey, clearState }),
    [state, setState, setStateByKey, clearState]
  );

  useEffect(() => {
    onInit?.(instance);
  }, [onInit, instance]);

  return instance;
};

export default useRuntimeStateManager;
