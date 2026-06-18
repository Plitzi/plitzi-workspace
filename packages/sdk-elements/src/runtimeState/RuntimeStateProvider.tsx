import { useEffect, useMemo, useRef } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';

import useRuntimeState from './useRuntimeState';

import type { CommonState, RuntimeState, RuntimeStateInstance } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

type StorageMode = 'localStorage' | 'sessionStorage';

export type RuntimeStateProviderProps = {
  children: ReactNode;
  webId: number;
  state?: RuntimeState;
  onInit?: (instance: RuntimeStateInstance) => void;
};

const readPersisted = (storageId: string, mode: StorageMode): RuntimeState => {
  try {
    const raw = (mode === 'localStorage' ? localStorage : sessionStorage).getItem(storageId);

    return raw ? (JSON.parse(raw) as RuntimeState) : {};
  } catch {
    return {};
  }
};

const writePersisted = (storageId: string, mode: StorageMode, value: RuntimeState): void => {
  try {
    (mode === 'localStorage' ? localStorage : sessionStorage).setItem(storageId, JSON.stringify(value));
  } catch {
    // Best-effort: ignore quota/serialization failures.
  }
};

// Owns the lifecycle of `runtime.state`: seeds the initial host-provided state, hydrates/mirrors it to
// local/session storage (key `plitzi_<webId>_state`) driven by the `keepState`/`stateStorage` settings, and
// exposes the instance to external hosts via `onInit`. Replaces the former `@plitzi/sdk-state` provider.
const RuntimeStateProvider = ({ children, webId, state: stateProp, onInit }: RuntimeStateProviderProps) => {
  const storageId = useMemo(() => `plitzi_${webId}_state`, [webId]);
  const { useStore } = createStoreHook<CommonState>();
  const [[keepState, stateStorage]] = useStore(['schema.settings.keepState', 'schema.settings.stateStorage']);
  const persistMode: StorageMode | undefined = keepState && stateStorage ? stateStorage : undefined;
  const { state, setState, setStateByKey, clearState } = useRuntimeState();

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) {
      return;
    }

    hydratedRef.current = true;
    const cached = persistMode ? readPersisted(storageId, persistMode) : {};
    setState({ ...(stateProp ?? {}), ...cached });
    // Seed once on mount, mirroring the legacy provider's init-time read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reseedRef = useRef(false);
  useEffect(() => {
    if (reseedRef.current) {
      setState(stateProp ?? {});
    } else {
      reseedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateProp]);

  const skipFirstWriteRef = useRef(true);
  useEffect(() => {
    if (!persistMode) {
      return;
    }

    if (skipFirstWriteRef.current) {
      skipFirstWriteRef.current = false;

      return;
    }

    writePersisted(storageId, persistMode, state);
  }, [state, persistMode, storageId]);

  const instance = useMemo<RuntimeStateInstance>(
    () => ({ state, setState, setStateByKey, clearState }),
    [state, setState, setStateByKey, clearState]
  );

  useEffect(() => {
    onInit?.(instance);
  }, [onInit, instance]);

  return children;
};

export default RuntimeStateProvider;
