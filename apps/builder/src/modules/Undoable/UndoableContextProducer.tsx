import { useCallback, useMemo, useReducer, useRef } from 'react';

import { SchemaActions } from '@plitzi/sdk-schema/SchemaReducer';
import { isUserEdit } from '@plitzi/sdk-shared/helpers';
import { StyleActions } from '@plitzi/sdk-style/StyleReducer';
import { SegmentsActions } from '@pmodules/Segments/SegmentsReducer';

import UndoableContext from './UndoableContext';
import UndoableReducer, { initialState } from './UndoableReducer';

import type { UndoableContextValue, UndoableItem } from './UndoableContext';
import type { SchemaReducerActions } from '@plitzi/sdk-schema/SchemaReducer';
import type { Schema, Segment, Style } from '@plitzi/sdk-shared';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';
import type { SegmentsReducerActions } from '@pmodules/Segments/SegmentsReducer';
import type { ReactNode } from 'react';

export type UndoableContextProducerProps = {
  children?: ReactNode;
};

const UndoableContextProducer = ({ children }: UndoableContextProducerProps) => {
  const [undoable, dispatchUndoable] = useReducer(UndoableReducer, initialState);
  const undoableRef = useRef(undoable);
  undoableRef.current = undoable;

  const processItem = useCallback(
    (
      item:
        | UndoableItem<Schema, SchemaReducerActions>
        | UndoableItem<Style, StyleReducerActions>
        | UndoableItem<Record<string, Segment>, SegmentsReducerActions>,
      isUndo = true
    ) => {
      switch (item.action.type) {
        case SchemaActions[item.action.type as keyof typeof SchemaActions]: {
          const schemaItem = item as UndoableItem<Schema, SchemaReducerActions>;
          schemaItem.dispatch({
            type: SchemaActions.SCHEMA_UPDATE,
            schema: isUndo ? schemaItem.prevState : schemaItem.nextState
          });
          return;
        }

        case StyleActions[item.action.type as keyof typeof StyleActions]: {
          const styleItem = item as UndoableItem<Style, StyleReducerActions>;
          styleItem.dispatch({
            type: StyleActions.STYLE_UPDATE,
            style: isUndo ? styleItem.prevState : styleItem.nextState
          });
          return;
        }

        case SegmentsActions[item.action.type as keyof typeof SegmentsActions]: {
          const segmentsItem = item as UndoableItem<Record<string, Segment>, SegmentsReducerActions>;
          const segmentId = (segmentsItem.prevState as unknown as SegmentsReducerActions).segmentId;

          segmentsItem.dispatch({
            type: SegmentsActions.SEGMENTS_UPDATE,
            segment: isUndo ? segmentsItem.prevState[segmentId] : segmentsItem.nextState[segmentId],
            segmentId
          });
          return;
        }

        default:
          return;
      }
    },
    []
  );

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
  const undoableMiddleware = useCallback<UndoableContextValue['undoableMiddleware']>(
    (prevState, state, dispatch, action) => {
      if (isUserEdit(action)) {
        undoableAddUndo(prevState, action, state, dispatch);

        return;
      }

      if (action.fromSubscriptions) {
        undoableClearHistory();
      }
    },
    [undoableAddUndo, undoableClearHistory]
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
