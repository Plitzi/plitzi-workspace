// Packages
import omit from 'lodash/omit';

export const UndoableActions = {
  UNDOABLE_ADD_UNDO: 'UNDOABLE_ADD_UNDO',
  UNDOABLE_UNDO: 'UNDOABLE_UNDO',
  UNDOABLE_REDO: 'UNDOABLE_REDO',
  // UNDOABLE_JUMP_TO_FUTURE: 'UNDOABLE_JUMP_TO_FUTURE',
  // UNDOABLE_JUMP_TO_PAST: 'UNDOABLE_JUMP_TO_PAST',
  // UNDOABLE_JUMP: 'UNDOABLE_JUMP',
  UNDOABLE_CLEAR_HISTORY: 'UNDOABLE_CLEAR_HISTORY'
};

export const initialState = {
  past: [],
  future: [],
  canUndo: false,
  canRedo: false
};

const UndoableReducer = (state, action = {}) => {
  switch (action.type) {
    case UndoableActions.UNDOABLE_ADD_UNDO: {
      const present = omit(action, ['type']);
      const newPast = [...state.past, present];

      return {
        past: newPast,
        future: [],
        canUndo: newPast.length > 0,
        canRedo: false
      };
    }

    case UndoableActions.UNDOABLE_UNDO:
    case UndoableActions.UNDOABLE_REDO: {
      return omit(action, ['type']);
    }

    case UndoableActions.UNDOABLE_CLEAR_HISTORY: {
      return initialState;
    }

    default:
      return state;
  }
};

export default UndoableReducer;
