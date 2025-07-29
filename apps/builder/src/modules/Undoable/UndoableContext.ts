import { createContext } from 'react';

import type { UndoableReducerActions } from './UndoableReducer';
import type { SchemaActions } from '@pmodules/Schema/SchemaReducer';
import type { StyleActions } from '@pmodules/Style/StyleReducer';
import type { ActionDispatch, AnyActionArg } from 'react';

export type UndoableItem<TState = unknown, TDispatchAction extends AnyActionArg = [action: unknown]> = {
  action: { type: keyof (typeof SchemaActions & typeof StyleActions) } & Record<string, unknown>;
  dispatch: ActionDispatch<TDispatchAction>;
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
  undoableMiddleware: (
    action: UndoableItem['action'],
    prevState: UndoableItem['prevState'],
    state: UndoableItem['nextState'],
    dispatch: UndoableItem['dispatch']
  ) => void;
};

const undoableContextDefaultValue = {} as UndoableContextValue;

const UndoableContext = createContext<UndoableContextValue>(undoableContextDefaultValue);

export default UndoableContext;
