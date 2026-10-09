import { createContext } from 'react';

import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import type { SchemaReducerActions } from '@plitzi/sdk-schema/SchemaReducer';
import type { Schema, Style } from '@plitzi/sdk-shared';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';
import type { ActionDispatch } from 'react';

export type QueueItem<TState, TDispatchAction> = {
  action: TDispatchAction;
  prevState: TState;
  state: TState;
  dispatch: ActionDispatch<[action: TDispatchAction]>;
};

/** A change the queue sends: to the schema or to the style, each with its own reducer's state and action. */
export type QueuedChange =
  | ({ kind: 'schema' } & QueueItem<Schema, SchemaReducerActions>)
  | ({ kind: 'style' } & QueueItem<Style, StyleReducerActions>);

export type QueueContextValue = {
  /** What queues the schema reducer's changes, as its middleware. */
  enqueueSchema: ReducerMiddlewareCallback<Schema, [action: SchemaReducerActions]>;
  /** What queues the style reducer's changes, as its middleware. */
  enqueueStyle: ReducerMiddlewareCallback<Style, [action: StyleReducerActions]>;
};

const queueContextDefaultValue: QueueContextValue = { enqueueSchema: () => {}, enqueueStyle: () => {} };

const QueueContext = createContext(queueContextDefaultValue);
QueueContext.displayName = 'QueueContext';

export default QueueContext;
