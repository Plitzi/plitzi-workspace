import type { InteractionNode, InteractionStatus } from './InteractionTypes';
import type { NavigationStatus } from './NavigationTypes';
import type { ElementInteraction } from './SchemaTypes';
import type { ReactNode } from 'react';

export type LogType = 'info' | 'warning' | 'danger' | 'success' | 'custom';
export type LogCategory = 'navigation' | 'interactions' | 'store' | 'network' | 'actions';

export type LogNavigation = { category: 'navigation'; params: { status: NavigationStatus; elementId: string } };
export type LogEventBridge = { category: 'eventBridge'; params: Record<string, unknown> };
export type LogInteraction = {
  category: 'interactions';
  params: {
    /** The SOURCE a global callback or utility named — `space`, `state` — not the element it ran on. */
    elementId: string;
    /** The id of the element the interaction fired on. What tells two identical-looking entries apart. */
    hostElementId?: string;
    startTime: number;
    endTime: number;
    node: ElementInteraction;
    status: InteractionStatus;
    nodes: Record<string, InteractionNode>;
  };
};
export type LogStore = {
  category: 'store';
  params: {
    storeName: string;
    path: string | undefined;
    prev: unknown;
    next: unknown;
  };
};

/**
 * A server action this page started, as a log line.
 *
 * Its own category rather than an `interactions` entry: an action is not a step that ran in the browser, and the
 * things worth reading about one — which way in, the server's run id, the reason it was refused — have no place
 * in a client flow's shape. The Actions tab shows the run in full; this is the line that says it happened, in the
 * stream where everything else the page did is already ordered.
 */
export type LogAction = {
  category: 'actions';
  params: {
    actionId: string;
    /** `await`, `detached`, `stream` — or `cancel` for a run somebody stopped. */
    mode?: string;
    /** The server's own id, once there is one. */
    runId?: string;
    status?: string;
    /** The server's vocabulary when it refused: `duplicate`, `over_capacity`, `recursion`, `forbidden`… */
    reason?: string;
    error?: string;
    output?: Record<string, unknown>;
  };
};

/** Something that arrived from the server and was not what it claimed to be — a space event failing its schema. */
export type LogNetwork = {
  category: 'network';
  params: { event: string; issues: { path: string; message: string }[]; payload?: unknown };
};

export type LogParams =
  | LogNavigation['params']
  | LogInteraction['params']
  | LogEventBridge['params']
  | LogStore['params']
  | LogNetwork['params']
  | LogAction['params'];
export type Log = { logType: string; message: ReactNode; time?: string } & (
  LogInteraction | LogNavigation | LogEventBridge | LogStore | LogNetwork | LogAction
);

export type ProviderCallback = (...args: unknown[]) => Record<string, unknown>;
