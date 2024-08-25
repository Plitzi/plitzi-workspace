// Packages
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import moment from 'moment';

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
  const valueMemo = useMemo(() => ({ logs, setLogs }), [logs, setLogs]);

  const handleAddLog = useCallback((logType, category, action, params) => {
    const time = moment().format('h:m:ss.SSS');
    setLogs(state => [...state, { message: `Action ${category}.${action} @ ${time}`, time, params }]);
  }, []);

  useEffect(() => {
    pConsole.setCallback(handleAddLog);

    return () => {
      pConsole.setCallback(undefined);
    };
  }, [handleAddLog]);

  return <DevToolsContext value={valueMemo}>{children}</DevToolsContext>;
};

export default DevToolsContextProvider;
