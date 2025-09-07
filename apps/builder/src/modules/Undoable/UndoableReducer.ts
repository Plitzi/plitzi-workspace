import omit from 'lodash/omit';

import type { UndoableItem } from './UndoableContext';

export type UndoableReducerActions =
  | ({ type: 'undoableAddUndo' } & UndoableItem)
  | { type: 'undoableUndo'; past: UndoableItem[]; future: UndoableItem[] }
  | { type: 'undoableRedo'; past: UndoableItem[]; future: UndoableItem[] }
  | { type: 'undoableClearHistory' };

export type UndoableState = {
  past: UndoableItem[];
  future: UndoableItem[];
  canUndo: boolean;
  canRedo: boolean;
};

export const initialState: UndoableState = {
  past: [],
  future: [],
  canUndo: false,
  canRedo: false
};

const UndoableReducer = (state: UndoableState = initialState, action: UndoableReducerActions): UndoableState => {
  switch (action.type) {
    case 'undoableAddUndo': {
      const present = omit(action, ['type']);
      const newPast = [...state.past, present];

      return {
        past: newPast,
        future: [],
        canUndo: newPast.length > 0,
        canRedo: false
      };
    }

    case 'undoableUndo':
    case 'undoableRedo': {
      return {
        past: action.past,
        future: action.future,
        canUndo: action.past.length > 0,
        canRedo: action.future.length > 0
      };
    }

    case 'undoableClearHistory': {
      return initialState;
    }

    default:
      return state;
  }
};

export default UndoableReducer;
