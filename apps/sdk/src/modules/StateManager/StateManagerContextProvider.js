// Packages
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { produce } from 'immer';
import noop from 'lodash/noop';
import set from 'lodash/set';
import get from 'lodash/get';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

// Alias
import NetworkContext from '@modules/Network/NetworkContext';

// Relatives
import StateManagerContext from './StateManagerContext';
import { emptyObject } from '../../helpers/utils';

export const STYLE_TYPE_NORMAL = 'normal';
export const STYLE_TYPE_PARTIAL = 'partial';
export const STYLE_TYPE_TEMPLATE = 'template';
export const STYLE_TYPE_SEGMENT = 'segment';

const StateManagerContextProvider = props => {
  const { children, state: stateProp = emptyObject, onInit = noop } = props;
  const { webId } = useContext(NetworkContext);
  const storageId = useMemo(() => `plitzi-${webId}-state`, [webId]);
  const { schema } = useContext(SchemaContext);

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
    const keepState = get(schema, 'settings.keepState', false);
    const storeMode = get(schema, 'settings.stateStorage', '');
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
        if (localStorage && storeMode === 'localStorage') {
          localStorage.removeItem(storageId);
        } else if (sessionStorage && storeMode === 'sessionStorage') {
          sessionStorage.removeItem(storageId);
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

  return <StateManagerContext.Provider value={valueMemo}>{children}</StateManagerContext.Provider>;
};

StateManagerContextProvider.propTypes = {
  children: PropTypes.node,
  state: PropTypes.object,
  onInit: PropTypes.func
};

export default StateManagerContextProvider;
