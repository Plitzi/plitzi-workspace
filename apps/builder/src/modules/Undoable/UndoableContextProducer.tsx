import { useCallback, useMemo, useReducer, useRef } from 'react';

import { SchemaActions } from '@plitzi/sdk-schema/SchemaReducer';
import { isUserEdit } from '@plitzi/sdk-shared/helpers';
import { StyleActions } from '@plitzi/sdk-style/StyleReducer';

import UndoableContext from './UndoableContext';
import UndoableReducer, { initialState } from './UndoableReducer';

import type { UndoableChange, UndoableContextValue } from './UndoableContext';
import type { ReactNode } from 'react';

export type UndoableContextProducerProps = {
  children?: ReactNode;
};

const UndoableContextProducer = ({ children }: UndoableContextProducerProps) => {
  const [undoable, dispatchUndoable] = useReducer(UndoableReducer, initialState);
  const undoableRef = useRef(undoable);
  undoableRef.current = undoable;

  const processItem = useCallback((change: UndoableChange, isUndo = true) => {
    if (change.kind === 'schema') {
      change.dispatch({ type: SchemaActions.SCHEMA_UPDATE, schema: isUndo ? change.prevState : change.nextState });

      return;
    }

    change.dispatch({ type: StyleActions.STYLE_UPDATE, style: isUndo ? change.prevState : change.nextState });
  }, []);

  const undoableAddUndo = useCallback(
    (change: UndoableChange) => dispatchUndoable({ type: 'undoableAddUndo', change }),
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

  /**
   * What the history is allowed to remember.
   *
   * It sees every action, not only the user's, because an entry holds a whole-state snapshot: undoing does not replay
   * an inverse, it puts the entire document back the way it was. That is sound while this session is the only writer
   * and false the instant it is not — after an agent writes through the MCP, or a collaborator saves, one click on
   * undo would restore a document from before their work and take it with it. So their edit ends the history rather
   * than being added to it. The user loses their own earlier steps, which is the honest price: those steps were taken
   * against a document that has since changed underneath them.
   *
   * A `queryFailed` revert is neither: the queue is putting back what a rejected mutation left behind, which the user
   * did not do and which invalidates nothing.
   */
  const remember = useCallback(
    (change: UndoableChange) => {
      if (isUserEdit(change.action)) {
        undoableAddUndo(change);

        return;
      }

      if (change.action.fromSubscriptions) {
        undoableClearHistory();
      }
    },
    [undoableAddUndo, undoableClearHistory]
  );

  const undoableSchema = useCallback<UndoableContextValue['undoableSchema']>(
    (prevState, nextState, dispatch, action) => remember({ kind: 'schema', prevState, nextState, dispatch, action }),
    [remember]
  );

  const undoableStyle = useCallback<UndoableContextValue['undoableStyle']>(
    (prevState, nextState, dispatch, action) => remember({ kind: 'style', prevState, nextState, dispatch, action }),
    [remember]
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
      undoableSchema,
      undoableStyle
    }),
    [
      canUndo,
      canRedo,
      dispatchUndoable,
      undoableAddUndo,
      undoableUndo,
      undoableRedo,
      undoableClearHistory,
      undoableSchema,
      undoableStyle
    ]
  );

  return <UndoableContext value={undoableValue}>{children}</UndoableContext>;
};

export default UndoableContextProducer;
