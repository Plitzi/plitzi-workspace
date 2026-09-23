/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext } from 'react';

import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import type { SchemaReducerActions } from '@plitzi/sdk-schema/SchemaReducer';
import type { Schema, Segment, Style } from '@plitzi/sdk-shared';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';
import type { SegmentsReducerActions } from '@pmodules/Segments/SegmentsReducer';
import type { ActionDispatch } from 'react';

export type QueueItem<TState = any, TDispatchAction = any> = {
  action: TDispatchAction;
  prevState: TState;
  state: TState;
  dispatch: ActionDispatch<[action: TDispatchAction]>;
};

export type QueueContextValue = {
  enqueueMiddleware: ReducerMiddlewareCallback<
    Schema | Style | Record<string, Segment>,
    [action: StyleReducerActions | SchemaReducerActions | SegmentsReducerActions]
  >;
};

const queueContextDefaultValue: QueueContextValue = { enqueueMiddleware: () => {} };

const QueueContext = createContext(queueContextDefaultValue);
QueueContext.displayName = 'QueueContext';

export default QueueContext;
