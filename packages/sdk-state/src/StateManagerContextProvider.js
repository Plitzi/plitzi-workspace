// Packages
import React, { useCallback, use, useEffect, useMemo, useRef, useState } from 'react';
import { produce } from 'immer';
import noop from 'lodash/noop';
import set from 'lodash/set';
import get from 'lodash/get';

// Monorepo
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import StateManagerContext from './StateManagerContext';

export const STYLE_TYPE_NORMAL = 'normal';
export const STYLE_TYPE_PARTIAL = 'partial';
export const STYLE_TYPE_TEMPLATE = 'template';
export const STYLE_TYPE_SEGMENT = 'segment';

/**
 * @param {{
 *   children: React.ReactNode;
 *   webId: number;
 *   state?: Record<string, any>;
 *   onInit: (value: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const StateManagerContextProvider = props => {
  const { children, webId, state: stateProp = emptyObject, onInit = noop } = props;
  const storageId = useMemo(() => `plitzi_${webId}_state`, [webId]);
  const settings = use(SchemaSettingsContext);

  const getCache = useCallback(
    (path, defaultValue = {}, storeMode = '') => {
      let serializedState = defaultValue;
      try {
        if (localStorage && storeMode === 'local') {
          serializedState = localStorage.getItem(storageId);
        } else if (sessionStorage && storeMode === 'session') {
          serializedState = sessionStorage.getItem(storageId);
        }

        if (typeof serializedState === 'string') {
          serializedState = JSON.parse(serializedState);
        }
      } catch (err) {
        serializedState = defaultValue;
      }

      if (!serializedState) {
        return defaultValue;
      }

      if (!path) {
        return serializedState;
      }

      return get(serializedState, path, defaultValue);
    },
    [storageId]
  );

  const [state, setState] = useState(() => {
    const keepState = get(settings, 'keepState', false);
    const storeMode = get(settings, 'stateStorage', '');
    if (keepState && storeMode) {
      return { ...stateProp, ...getCache('', {}, storeMode) };
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
    (value, path = '', storeMode = '') => {
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
        if (localStorage && storeMode === 'local') {
          localStorage.setItem(storageId, serializedState);
        } else if (sessionStorage && storeMode === 'session') {
          sessionStorage.setItem(storageId, serializedState);
        }
      } catch (err) {
        return false;
      }

      return true;
    },
    [storageId, getCache]
  );

  const clearCache = useCallback(
    storeMode => {
      try {
        if (localStorage && storeMode === 'local') {
          localStorage.removeItem(storageId);
          setState({});
        } else if (sessionStorage && storeMode === 'session') {
          sessionStorage.removeItem(storageId);
          setState({});
        }
      } catch (err) {
        // Nothing to do here
      }
    },
    [storageId]
  );

  const setStateByKey = useCallback(
    (key, value, storeMode = '') => {
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
