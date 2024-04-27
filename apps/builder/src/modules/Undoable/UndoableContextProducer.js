// Packages
import React, { useCallback, useMemo, useReducer, useRef } from 'react';

// Alias
import { SchemaActions } from '@pmodules/Schema/SchemaReducer';
import { StyleActions } from '@pmodules/Style/StyleReducer';

// Relatives
import UndoableContext from './UndoableContext';
import UndoableReducer, { initialState, UndoableActions } from './UndoableReducer';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const UndoableContextProducer = props => {
  const { children } = props;
  const [undoable, dispatchUndoable] = useReducer(UndoableReducer, initialState);
  const undoableRef = useRef(undoable);
  undoableRef.current = undoable;

  const processItem = useCallback(async (item, isUndo = true) => {
    const {
      action: { type },
      prevState,
      nextState,
      dispatch
    } = item;
    switch (type) {
      case SchemaActions[type]: {
        return dispatch({ type: SchemaActions.SCHEMA_UPDATE, schema: isUndo ? prevState : nextState });
      }

      case StyleActions[type]: {
        return dispatch({ type: StyleActions.STYLE_UPDATE, style: isUndo ? prevState : nextState });
      }

      default:
        return null;
    }
  }, []);

  const undoableAddUndo = useCallback(
    (prevState, action, nextState, dispatch) => {
      dispatchUndoable({ type: UndoableActions.UNDOABLE_ADD_UNDO, prevState, action, nextState, dispatch });
    },
    [dispatchUndoable]
  );

  const undoableUndo = useCallback(() => {
    const { canUndo, past, future } = undoableRef.current;
    if (canUndo) {
      const previous = past.pop();
      const newFuture = [...future, previous];
      processItem(previous);

      dispatchUndoable({
        type: UndoableActions.UNDOABLE_UNDO,
        past,
        future: newFuture,
        canUndo: past.length > 0,
        canRedo: newFuture.length > 0
      });
    }
  }, [dispatchUndoable, processItem]);

  const undoableRedo = useCallback(() => {
    const { canRedo, past, future } = undoableRef.current;
    if (canRedo) {
      const next = future.pop();
      const newPast = [...past, next];
      processItem(next, false);

      dispatchUndoable({
        type: UndoableActions.UNDOABLE_REDO,
        past: newPast,
        future,
        canUndo: newPast.length > 0,
        canRedo: future.length > 0
      });
    }
  }, [dispatchUndoable, processItem]);

  // export function undoableJumpToFuture(index) {
  //   return { type: UndoableActions.UNDOABLE_JUMP_TO_FUTURE, index };
  // }

  // export function undoableJumpToPast(index) {
  //   return { type: UndoableActions.UNDOABLE_JUMP_TO_PAST, index };
  // }

  // export function undoableJump(index) {
  //   return { type: UndoableActions.UNDOABLE_JUMP, index };
  // }

  const undoableClearHistory = useCallback(() => {
    dispatchUndoable({ type: UndoableActions.UNDOABLE_CLEAR_HISTORY });
  }, [dispatchUndoable]);

  const undoableMiddleware = useCallback(
    (action, prevState, state, dispatch) => undoableAddUndo(prevState, action, state, dispatch),
    [undoableAddUndo]
  );

  const { canUndo, canRedo } = undoable;

  const undoableValue = useMemo(
    () => ({
      canUndo,
      canRedo,
      dispatchUndoable,
      undoableAddUndo,
      undoableUndo,
      undoableRedo,
      undoableClearHistory,
      undoableMiddleware
    }),
    [
      canUndo,
      canRedo,
      dispatchUndoable,
      undoableAddUndo,
      undoableUndo,
      undoableRedo,
      undoableClearHistory,
      undoableMiddleware
    ]
  );

  return <UndoableContext.Provider value={undoableValue}>{children}</UndoableContext.Provider>;
};

export default UndoableContextProducer;
