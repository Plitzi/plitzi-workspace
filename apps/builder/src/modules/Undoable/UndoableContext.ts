import { createContext } from 'react';

import type { UndoableActions, UndoableState } from './UndoableReducer';
import type { ActionDispatch, AnyActionArg } from 'react';

export type UndoableContextValue = {
  canUndo: boolean;
  canRedo: boolean;
  dispatchUndoable: ActionDispatch<AnyActionArg>;
  undoableAddUndo: (prevState: UndoableState, action: UndoableActions, nextState: UndoableState, dispatch) => void;
  undoableUndo: () => void;
  undoableRedo: () => void;
  undoableClearHistory: () => void;
  undoableMiddleware: (action: UndoableActions, prevState: UndoableState, state: UndoableState, dispatch) => void;
};

const undoableContextDefaultValue = {} as UndoableContextValue;

const UndoableContext = createContext<UndoableContextValue>(undoableContextDefaultValue);

export default UndoableContext;
