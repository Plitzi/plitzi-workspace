import omit from 'lodash/omit';

export type UndoableActions = 'undoableAddUndo' | 'undoableUndo' | 'undoableRedo' | 'UndoableClearHistory';

export type UndoableState = {
  past: unknown[];
  future: unknown[];
  canUndo: boolean;
  canRedo: boolean;
};

export const initialState = {
  past: [],
  future: [],
  canUndo: false,
  canRedo: false
};

const UndoableReducer = (
  state: UndoableState = initialState,
  action: { type: UndoableActions; past: unknown; present: unknown }
) => {
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
      return omit(action, ['type']);
    }

    case 'UndoableClearHistory': {
      return initialState;
    }

    default:
      return state;
  }
};

export default UndoableReducer;
