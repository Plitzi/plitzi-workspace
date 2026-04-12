import { createContext } from 'react';

import type { Log, ProviderCallback } from '../types';
import type { Dispatch, SetStateAction } from 'react';

export type DevToolsContextValue = {
  providers: Record<string, ProviderCallback>;
  logs: Log[];
  setLogs?: Dispatch<SetStateAction<Log[]>>;
  clearLogs?: () => void;
  getData?: (methodName: string, ...args: unknown[]) => Record<string, unknown> | undefined;
};

const devToolsContextDefaultValue = { logs: [], providers: {} };

const DevToolsContext = createContext<DevToolsContextValue>(devToolsContextDefaultValue);
DevToolsContext.displayName = 'DevToolsContext';

export default DevToolsContext;
