// Packages
import React, { useMemo, useState, useEffect, useCallback } from 'react';

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

  const handleAddLog = useCallback(
    (logType, category, message, params, time) => {
      setLogs(state => [...state, { logType, category, message, time, params }]);
    },
    [setLogs]
  );

  const handleClearLogs = useCallback(() => setLogs([]), []);

  useEffect(() => {
    pConsole.setCallback(handleAddLog);

    return () => {
      pConsole.setCallback(undefined);
    };
  }, [handleAddLog]);

  const valueMemo = useMemo(() => ({ logs, clearLogs: handleClearLogs, setLogs }), [logs, setLogs, handleClearLogs]);

  return <DevToolsContext value={valueMemo}>{children}</DevToolsContext>;
};

export default DevToolsContextProvider;
