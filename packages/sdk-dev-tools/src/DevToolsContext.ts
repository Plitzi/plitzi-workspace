// Package
import { createContext } from 'react';

// Types
import type { RuleValue } from '@plitzi/plitzi-ui';
import type { ElementInteraction } from '@plitzi/sdk-shared';
import type { ReactNode, Dispatch, SetStateAction } from 'react';

export type LogType = 'info' | 'warning' | 'danger' | 'success' | 'custom';
export type LogCategory = 'navigation' | 'interactions';

// @todo: status should come from each module
export type NavigationStatus = 'normal' | 'redirect' | 'notFound' | 'accessDenied'; // @todo: move later
export type InteractionStatus = 'completed' | 'skipped'; // @todo: move later
export type InteractionNodeStatus = 'success' | 'failed' | 'skipped' | 'disabled'; // @todo: move later

export type LogNavigation = { category: 'navigation'; params: { status: NavigationStatus; elementId: string } };
export type LogInteraction = {
  category: 'interactions';
  params: {
    elementId: string;
    startTime: number;
    endTime: number;
    node: ElementInteraction;
    status: InteractionStatus;
    nodes: Record<
      string,
      {
        node: ElementInteraction;
        status: InteractionNodeStatus;
        postCallbacks: unknown[];
        result?: unknown;
        startTime: number;
        endTime: number;
        whenParams?: Record<string, RuleValue>;
      }
    >;
  };
};

export type LogParams = LogNavigation['params'] | LogInteraction['params'];
export type Log = { logType: string; message: ReactNode; time?: string } & (LogInteraction | LogNavigation);

export type ProviderCallback = (...args: unknown[]) => Record<string, unknown>;
export type DevToolsContextValue = {
  providers: Record<string, ProviderCallback>;
  logs: Log[];
  setLogs?: Dispatch<SetStateAction<Log[]>>;
  clearLogs?: () => void;
  getData?: (methodName: string, ...args: unknown[]) => Record<string, unknown> | undefined;
};

const devToolsContextDefaultValue = { logs: [], providers: {} };

const DevToolsContext = createContext<DevToolsContextValue>(devToolsContextDefaultValue);

export default DevToolsContext;
