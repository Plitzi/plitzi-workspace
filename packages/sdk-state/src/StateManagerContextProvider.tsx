// Packages
import { produce } from 'immer';
import get from 'lodash/get';
import set from 'lodash/set';
import { useCallback, use, useEffect, useMemo, useRef, useState } from 'react';

// Monorepo
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import StateManagerContext from './StateManagerContext';

// Types
import type { ReactNode } from 'react';

export const STYLE_TYPE_NORMAL = 'normal';
export const STYLE_TYPE_PARTIAL = 'partial';
export const STYLE_TYPE_TEMPLATE = 'template';
export const STYLE_TYPE_SEGMENT = 'segment';

export type StateManagerContextProviderProps = {
  children: ReactNode;
  webId: number;
  state: Record<string, unknown>;
  onInit: (value: Record<string, unknown>) => void;
};

const StateManagerContextProvider = ({
  children,
  webId,
  state: stateProp = emptyObject,
  onInit
}: StateManagerContextProviderProps) => {
  const storageId = useMemo(() => `plitzi_${webId}_state`, [webId]);
  const settings = use(SchemaSettingsContext);

  const getCache = useCallback(
    (path?: string, defaultValue: Record<string, unknown> = {}, storeMode = '') => {
      let serializedState: Record<string, unknown> | string | null = defaultValue;
      try {
        if (storeMode === 'local') {
          serializedState = localStorage.getItem(storageId);
        } else if (storeMode === 'session') {
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
    const keepState: boolean = get(settings, 'keepState', false) as boolean;
    const storeMode: string = get(settings, 'stateStorage', '');
    if (keepState && storeMode) {
      return {
        ...stateProp,
        ...(getCache('', {}, storeMode) as Record<string, unknown>)
      };
    }

    return stateProp;
  });

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) {
      setState(stateProp);
    } else {
      initRef.current = true;
    }
  }, [stateProp]);

  const setCache = useCallback(
    (value: Record<string, unknown>, path = '', storeMode = '') => {
      const currentState = getCache() as Record<string, unknown>;
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
        if (storeMode === 'local') {
          localStorage.setItem(storageId, serializedState);
        } else if (storeMode === 'session') {
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
        if (storeMode === 'local') {
          localStorage.removeItem(storageId);
          setState({});
        } else if (storeMode === 'session') {
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
    (key: string, value: unknown, storeMode = '') => {
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
