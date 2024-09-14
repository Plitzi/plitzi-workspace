// Packages
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import omit from 'lodash/omit';
import get from 'lodash/get';
import noop from 'lodash/noop';

// Relatives
import DevToolsContext from './DevToolsContext';
import { pConsole } from './utils/PlitziConsole';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const DevToolsContextProvider = props => {
  const { children } = props;
  const [logs, setLogs] = useState([]);
  const [providers, setProviders] = useState({});
  const initRef = useRef(false);

  const handleAddLog = useCallback(
    (logType, category, message, params, time) => {
      setLogs(state => [...state, { logType, category, message, time, params }]);
    },
    [setLogs]
  );

  const handleAddProvider = useCallback(
    (methodName, callback) => setProviders(state => ({ ...state, [methodName]: callback })),
    []
  );

  const handleRemoveProvider = useCallback(methodName => setProviders(state => omit(state, [methodName])), []);

  const handleGetDataFromProviders = useCallback(
    (methodName, ...args) => {
      if (!methodName || !providers[methodName]) {
        return undefined;
      }

      return get(providers, methodName, noop)(...args);
    },
    [providers]
  );

  const handleClearLogs = useCallback(() => setLogs([]), []);

  if (!initRef.current) {
    pConsole.setCallback(handleAddLog);
    pConsole.setCallbackAddProvider(handleAddProvider);
    pConsole.setCallbackRemoveProvider(handleRemoveProvider);
    initRef.current = true;
  }

  useEffect(() => {
    pConsole.setCallback(handleAddLog);
    pConsole.setCallbackAddProvider(handleAddProvider);
    pConsole.setCallbackRemoveProvider(handleRemoveProvider);

    return () => {
      pConsole.setCallback(undefined);
      pConsole.setCallbackAddProvider(undefined);
      pConsole.setCallbackRemoveProvider(undefined);
    };
  }, [handleAddLog]);

  const valueMemo = useMemo(
    () => ({
      providers,
      logs,
      setLogs,
      clearLogs: handleClearLogs,
      getData: handleGetDataFromProviders
    }),
    [providers, logs, setLogs, handleClearLogs, handleGetDataFromProviders]
  );

  return <DevToolsContext value={valueMemo}>{children}</DevToolsContext>;
};

export default DevToolsContextProvider;
