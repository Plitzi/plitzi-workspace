/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext } from 'react';

import type { UndoableReducerActions } from './UndoableReducer';
import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import type { SchemaReducerActions } from '@plitzi/sdk-schema/SchemaReducer';
import type { Schema, Segment, Style } from '@plitzi/sdk-shared';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';
import type { SegmentsReducerActions } from '@pmodules/Segments/SegmentsReducer';
import type { ActionDispatch } from 'react';

export type UndoableItem<TState = any, TDispatchAction = any> = {
  action: TDispatchAction;
  dispatch: ActionDispatch<[action: TDispatchAction]>;
  nextState: TState;
  prevState: TState;
};

export type UndoableDispatch = ActionDispatch<[action: UndoableReducerActions]>;

export type UndoableContextValue = {
  canUndo: boolean;
  canRedo: boolean;
  dispatchUndoable: ActionDispatch<[action: UndoableReducerActions]>;
  undoableAddUndo: (
    prevState: UndoableItem['prevState'],
    action: UndoableItem['action'],
    nextState: UndoableItem['nextState'],
    dispatch: UndoableItem['dispatch']
  ) => void;
  undoableUndo: () => void;
  undoableRedo: () => void;
  undoableClearHistory: () => void;
  undoableMiddleware: ReducerMiddlewareCallback<
    Schema | Style | Record<string, Segment>,
    [action: StyleReducerActions | SchemaReducerActions | SegmentsReducerActions]
  >;
};

const undoableContextDefaultValue = {} as UndoableContextValue;

const UndoableContext = createContext(undoableContextDefaultValue);

export default UndoableContext;
