import { useCallback, useMemo, useReducer, useRef } from 'react';

import { SchemaActions } from '@pmodules/Schema/SchemaReducer';
import { SegmentsActions } from '@pmodules/Segments/SegmentsReducer';
import { StyleActions } from '@pmodules/Style/StyleReducer';

import UndoableContext from './UndoableContext';
import UndoableReducer, { initialState } from './UndoableReducer';

import type { UndoableItem } from './UndoableContext';
import type { Schema, Segment, Style } from '@plitzi/sdk-shared';
import type { SchemaReducerActions } from '@pmodules/Schema/SchemaReducer';
import type { SegmentsReducerActions } from '@pmodules/Segments/SegmentsReducer';
import type { StyleReducerActions } from '@pmodules/Style/StyleReducer';
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
        case SchemaActions[item.action.type]: {
          item = item as UndoableItem<Schema, SchemaReducerActions>;
          item.dispatch({ type: SchemaActions.SCHEMA_UPDATE, schema: isUndo ? item.prevState : item.nextState });

          return;
        }

        case StyleActions[item.action.type]: {
          item = item as UndoableItem<Style, StyleReducerActions>;
          item.dispatch({ type: StyleActions.STYLE_UPDATE, style: isUndo ? item.prevState : item.nextState });

          return;
        }

        case SegmentsActions[item.action.type]: {
          item = item as UndoableItem<Record<string, Segment>, SegmentsReducerActions>;
          const segmentId = (item.prevState as unknown as SegmentsReducerActions).segmentId;
          item.dispatch({
            type: SegmentsActions.SEGMENTS_UPDATE,
            segment: isUndo ? item.prevState[segmentId] : item.nextState[segmentId],
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
