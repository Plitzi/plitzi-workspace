import { useCallback, useMemo, useReducer, useRef } from 'react';

import { SchemaActions } from '@pmodules/Schema/SchemaReducer';
import { StyleActions } from '@pmodules/Style/StyleReducer';

import UndoableContext from './UndoableContext';
import UndoableReducer, { initialState } from './UndoableReducer';

import type { UndoableItem } from './UndoableContext';
import type { ReactNode } from 'react';

export type UndoableContextProducerProps = {
  children?: ReactNode;
};

const UndoableContextProducer = ({ children }: UndoableContextProducerProps) => {
  const [undoable, dispatchUndoable] = useReducer(UndoableReducer, initialState);
  const undoableRef = useRef(undoable);
  undoableRef.current = undoable;

  const processItem = useCallback((item: UndoableItem, isUndo = true) => {
    const {
      action: { type },
      prevState,
      nextState,
      dispatch
    } = item;
    switch (type) {
      case SchemaActions[type]: {
        dispatch({ type: SchemaActions.SCHEMA_UPDATE, schema: isUndo ? prevState : nextState });

        return;
      }

      case StyleActions[type]: {
        dispatch({ type: StyleActions.STYLE_UPDATE, style: isUndo ? prevState : nextState });

        return;
      }

      default:
        return;
    }
  }, []);

  const undoableAddUndo = useCallback(
    (
      prevState: UndoableItem['prevState'],
      action: UndoableItem['action'],
      nextState: UndoableItem['nextState'],
      dispatch: UndoableItem['dispatch']
    ) => {
      dispatchUndoable({ type: 'undoableAddUndo', prevState, action, nextState, dispatch });
    },
    [dispatchUndoable]
  );

  const undoableUndo = useCallback(() => {
    const { canUndo, past, future } = undoableRef.current;
    if (canUndo) {
      const previous = past.pop();
      if (!previous) {
        return;
      }

      const newFuture = [...future, previous];
      processItem(previous);
      dispatchUndoable({ type: 'undoableUndo', past, future: newFuture });
    }
  }, [dispatchUndoable, processItem]);

  const undoableRedo = useCallback(() => {
    const { canRedo, past, future } = undoableRef.current;
    if (canRedo) {
      const next = future.pop();
      if (!next) {
        return;
      }

      const newPast = [...past, next];
      processItem(next, false);
      dispatchUndoable({ type: 'undoableRedo', past: newPast, future });
    }
  }, [dispatchUndoable, processItem]);

  const undoableClearHistory = useCallback(() => {
    dispatchUndoable({ type: 'undoableClearHistory' });
  }, [dispatchUndoable]);

  const undoableMiddleware = useCallback(
    (
      action: UndoableItem['action'],
      prevState: UndoableItem['prevState'],
      state: UndoableItem['nextState'],
      dispatch: UndoableItem['dispatch']
    ) => undoableAddUndo(prevState, action, state, dispatch),
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

  return <UndoableContext value={undoableValue}>{children}</UndoableContext>;
};

export default UndoableContextProducer;
