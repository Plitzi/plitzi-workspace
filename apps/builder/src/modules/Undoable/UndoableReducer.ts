import type { UndoableChange } from './UndoableContext';

export type UndoableReducerActions =
  | { type: 'undoableAddUndo'; change: UndoableChange }
  | { type: 'undoableUndo'; past: UndoableChange[]; future: UndoableChange[] }
  | { type: 'undoableRedo'; past: UndoableChange[]; future: UndoableChange[] }
  | { type: 'undoableClearHistory' };

export type UndoableState = {
  past: UndoableChange[];
  future: UndoableChange[];
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
      const present = action.change;
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
      // Same object when there was nothing to clear: every remote edit asks for this, and a fresh state object would
      // re-render every consumer of the context for nothing.
      return state.past.length === 0 && state.future.length === 0 ? state : initialState;
    }

    default:
      return state;
  }
};

export default UndoableReducer;
