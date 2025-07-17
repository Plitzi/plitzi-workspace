import { createContext } from 'react';

import type { Dispatch } from 'react';

export type QueueItem = {
  action: { type: string } & Record<Exclude<string, 'type'>, unknown>;
  prevState: unknown;
  state: unknown;
  dispatch: Dispatch<unknown>;
};

export type QueuePriority = 'normal' | 'urgent' | 'all';

export type QueueContextValue = {
  queueManager: {
    count: (priority?: QueuePriority) => number;
    enqueue: (items?: QueueItem | QueueItem[], priority?: QueuePriority) => void;
    getIsProcessing: () => boolean;
  };
  enqueueMiddleware: (
    action: {
      type: string;
    } & Record<Exclude<string, 'type'>, unknown>,
    prevState: unknown,
    state: unknown,
    dispatch: Dispatch<unknown>
  ) => void;
};

const queueContextDefaultValue = { queueManager: {}, enqueueMiddleware: () => {} } as unknown as QueueContextValue;

const QueueContext = createContext<QueueContextValue>(queueContextDefaultValue);

export default QueueContext;
