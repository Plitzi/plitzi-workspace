/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext } from 'react';

import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import type { Schema, Segment, Style } from '@plitzi/sdk-shared';
import type { StyleReducerActions } from '@plitzi/sdk-Style/StyleReducer';
import type { SchemaReducerActions } from '@pmodules/Schema/SchemaReducer';
import type { SegmentsReducerActions } from '@pmodules/Segments/SegmentsReducer';
import type { ActionDispatch } from 'react';

export type QueueItem<TState = any, TDispatchAction = any> = {
  action: TDispatchAction;
  prevState: TState;
  state: TState;
  dispatch: ActionDispatch<[action: TDispatchAction]>;
};

export type QueuePriority = 'normal' | 'urgent' | 'all';

export type QueueContextValue = {
  queueManager: {
    count: (priority?: QueuePriority) => number;
    enqueue: (items?: QueueItem | QueueItem[], priority?: QueuePriority) => void;
    getIsProcessing: () => boolean;
  };
  enqueueMiddleware: ReducerMiddlewareCallback<
    Schema | Style | Record<string, Segment>,
    [action: StyleReducerActions | SchemaReducerActions | SegmentsReducerActions]
  >;
};

const queueContextDefaultValue = { queueManager: {}, enqueueMiddleware: () => {} } as unknown as QueueContextValue;

const QueueContext = createContext(queueContextDefaultValue);

export default QueueContext;
