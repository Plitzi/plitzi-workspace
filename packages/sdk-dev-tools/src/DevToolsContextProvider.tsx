import { omit } from '@plitzi/plitzi-ui/helpers';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';

import { pConsole } from '@plitzi/sdk-shared/devTools';
import { DevToolsContext } from '@plitzi/sdk-shared/devTools/react';

import type { Log, ProviderCallback } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type DevToolsContextProviderProps = {
  children?: ReactNode;
};

const DevToolsContextProvider = ({ children }: DevToolsContextProviderProps) => {
  // From what the page logged before this panel mounted: opening it from the badge can mount it again elsewhere in
  // the layout, and a panel that started empty showed none of the warnings its badge counted.
  const [logs, setLogs] = useState<Log[]>(() => pConsole.history());
  const [providers, setProviders] = useState<Record<string, ProviderCallback>>({});
  const initRef = useRef(false);

  const handleAddLog = useCallback(
    (
      logType: Log['logType'],
      category: Log['category'],
      message: Log['message'],
      params: Log['params'] | Record<string, unknown>,
      time?: Log['time']
    ) => {
      setLogs(state => [...state, { logType, category, message, time, params } as Log]);
    },
    [setLogs]
  );

  const handleAddProvider = useCallback(
    (methodName: string, callback: ProviderCallback) => setProviders(state => ({ ...state, [methodName]: callback })),
    []
  );

  const handleRemoveProvider = useCallback(
    (methodName: string) => setProviders(state => omit(state, [methodName])),
    []
  );

  const handleGetDataFromProviders = useCallback(
    (methodName: string, ...args: unknown[]) => {
      if (!methodName || typeof providers[methodName] !== 'function') {
        return undefined;
      }

      return providers[methodName](...args);
    },
    [providers]
  );

  const handleClearLogs = useCallback(() => {
    pConsole.clearHistory();
    setLogs([]);
  }, []);

  if (!initRef.current) {
    pConsole.setCallback(handleAddLog);
    pConsole.setCallbackAddProvider(handleAddProvider);
    pConsole.setCallbackRemoveProvider(handleRemoveProvider);
    initRef.current = true;
  }

  useEffect(() => {
    // The history holds what waited for a panel: taken whole, once, never delivered a second time.
    setLogs(pConsole.history());
    pConsole.dropPending();
    pConsole.setCallback(handleAddLog);
    pConsole.setCallbackAddProvider(handleAddProvider);
    pConsole.setCallbackRemoveProvider(handleRemoveProvider);

    return () => {
      pConsole.setCallback(undefined);
      pConsole.setCallbackAddProvider(undefined);
      pConsole.setCallbackRemoveProvider(undefined);
      pConsole.flush();
    };
  }, [handleAddLog, handleAddProvider, handleRemoveProvider]);

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
