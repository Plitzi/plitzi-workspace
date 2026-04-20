import { useCallback, useMemo, useReducer, useRef } from 'react';

import { SchemaActions } from '@plitzi/sdk-schema/SchemaReducer';
import { StyleActions } from '@plitzi/sdk-style/StyleReducer';
import { SegmentsActions } from '@pmodules/Segments/SegmentsReducer';

import UndoableContext from './UndoableContext';
import UndoableReducer, { initialState } from './UndoableReducer';

import type { UndoableItem } from './UndoableContext';
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

  const undoableMiddleware = useCallback(
    (
      prevState: UndoableItem['prevState'],
      state: UndoableItem['nextState'],
      dispatch: UndoableItem['dispatch'],
      action: UndoableItem['action']
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
