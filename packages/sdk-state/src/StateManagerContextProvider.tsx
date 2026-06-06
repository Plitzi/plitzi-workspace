import { get, set } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';

import StateManagerContext from './StateManagerContext';

import type { CommonState, StateManagerContextValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export const STYLE_TYPE_NORMAL = 'normal';
export const STYLE_TYPE_PARTIAL = 'partial';
export const STYLE_TYPE_TEMPLATE = 'template';
export const STYLE_TYPE_SEGMENT = 'segment';

export type StateManagerContextProviderProps = {
  children: ReactNode;
  webId: number;
  state?: Record<string, unknown>;
  onInit?: (instance: StateManagerContextValue) => void;
};

const StateManagerContextProvider = ({
  children,
  webId,
  state: stateProp,
  onInit
}: StateManagerContextProviderProps) => {
  const storageId = useMemo(() => `plitzi_${webId}_state`, [webId]);
  const { useStore } = createStoreHook<CommonState>();
  const [settings] = useStore('schema.settings');

  const getCache = useCallback(
    (path?: string, defaultValue: Record<string, unknown> = {}, storeMode?: 'localStorage' | 'sessionStorage') => {
      let serializedState: Record<string, unknown> | string | null = defaultValue;
      try {
        if (storeMode === 'localStorage') {
          serializedState = localStorage.getItem(storageId);
        } else if (storeMode === 'sessionStorage') {
          serializedState = sessionStorage.getItem(storageId);
        }

        if (typeof serializedState === 'string') {
          serializedState = JSON.parse(serializedState) as Record<string, unknown>;
        }
      } catch {
        serializedState = defaultValue;
      }

      if (!path) {
        return serializedState as Record<string, unknown>;
      }

      return get(serializedState, path, defaultValue);
    },
    [storageId]
  );

  const [state, setState] = useState<Record<string, unknown>>(() => {
    const keepState: boolean = get(settings, 'keepState', false);
    const storeMode: 'localStorage' | 'sessionStorage' | undefined = get(settings, 'stateStorage', undefined);
    if (keepState && storeMode) {
      return { ...(stateProp ?? {}), ...getCache('', {}, storeMode) };
    }

    return stateProp ?? {};
  });

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) {
      setState(stateProp ?? {});
    } else {
      initRef.current = true;
    }
  }, [stateProp]);

  const setCache = useCallback(
    (value: Record<string, unknown>, path = '', storeMode = '') => {
      const currentState = getCache();
      let newState = currentState;
      if (path) {
        newState = produce(currentState, draft => {
          set(draft, path, value);
        });
      } else {
        newState = value;
      }

      try {
        const serializedState = JSON.stringify(newState);
        if (storeMode === 'localStorage') {
          localStorage.setItem(storageId, serializedState);
        } else if (storeMode === 'sessionStorage') {
          sessionStorage.setItem(storageId, serializedState);
        }
      } catch {
        return false;
      }

      return true;
    },
    [storageId, getCache]
  );

  const clearCache = useCallback(
    (storeMode = '') => {
      try {
        if (storeMode === 'localStorage') {
          localStorage.removeItem(storageId);
          setState({});
        } else if (storeMode === 'sessionStorage') {
          sessionStorage.removeItem(storageId);
          setState({});
        }
      } catch {
        // Nothing to do here
      }
    },
    [storageId]
  );

  const setStateByKey = useCallback(
    (key: string, value: unknown, storeMode?: 'localStorage' | 'sessionStorage') => {
      setState(state => {
        const newState = produce(state, draft => {
          set(draft, key, value);
        });

        if (storeMode) {
          setCache(newState, '', storeMode);
        }

        return newState;
      });
    },
    [setCache]
  );

  const valueMemo = useMemo(
    () => ({ state, setState, setStateByKey, clearCache }),
    [state, setState, setStateByKey, clearCache]
  );

  useEffect(() => {
    if (typeof onInit === 'function') {
      onInit(valueMemo);
    }
  }, [onInit, valueMemo]);

  return <StateManagerContext value={valueMemo}>{children}</StateManagerContext>;
};

export default StateManagerContextProvider;
