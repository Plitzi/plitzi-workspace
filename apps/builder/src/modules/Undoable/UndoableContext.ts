import { createContext } from 'react';

import type { UndoableReducerActions } from './UndoableReducer';
import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import type { SchemaReducerActions } from '@plitzi/sdk-schema/SchemaReducer';
import type { Schema, Style } from '@plitzi/sdk-shared';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';
import type { ActionDispatch } from 'react';

export type UndoableItem<TState, TDispatchAction> = {
  action: TDispatchAction;
  dispatch: ActionDispatch<[action: TDispatchAction]>;
  nextState: TState;
  prevState: TState;
};

/** A change the history keeps: to the schema or to the style, each with its own reducer's state and action. */
export type UndoableChange =
  | ({ kind: 'schema' } & UndoableItem<Schema, SchemaReducerActions>)
  | ({ kind: 'style' } & UndoableItem<Style, StyleReducerActions>);

export type UndoableContextValue = {
  canUndo: boolean;
  canRedo: boolean;
  dispatchUndoable: ActionDispatch<[action: UndoableReducerActions]>;
  undoableAddUndo: (change: UndoableChange) => void;
  undoableUndo: () => void;
  undoableRedo: () => void;
  undoableClearHistory: () => void;
  /** What remembers the schema reducer's changes, as its middleware. */
  undoableSchema: ReducerMiddlewareCallback<Schema, [action: SchemaReducerActions]>;
  /** What remembers the style reducer's changes, as its middleware. */
  undoableStyle: ReducerMiddlewareCallback<Style, [action: StyleReducerActions]>;
};

const undoableContextDefaultValue = {} as UndoableContextValue;

const UndoableContext = createContext(undoableContextDefaultValue);
UndoableContext.displayName = 'UndoableContext';

export default UndoableContext;
