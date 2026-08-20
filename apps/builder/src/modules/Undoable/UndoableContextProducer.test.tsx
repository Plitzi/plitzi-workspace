import { act, render } from '@testing-library/react';
import { use } from 'react';
import { describe, expect, it, vi } from 'vitest';

import UndoableContext from './UndoableContext';
import UndoableContextProducer from './UndoableContextProducer';

import type { UndoableContextValue } from './UndoableContext';
import type { Schema } from '@plitzi/sdk-shared';

const snapshot = { flat: {} } as Schema;

const renderProducer = () => {
  let undoable!: UndoableContextValue;
  const Probe = () => {
    undoable = use(UndoableContext);

    return null;
  };

  render(
    <UndoableContextProducer>
      <Probe />
    </UndoableContextProducer>
  );

  return () => undoable;
};

// What the reducers hand the middleware: the state on either side of the action, the dispatch to replay it with, and
// the action itself.
const dispatchThrough = (undoable: UndoableContextValue, action: Parameters<typeof undoable.undoableMiddleware>[3]) =>
  act(() => undoable.undoableMiddleware(snapshot, snapshot, vi.fn(), action));

describe('what the undo history remembers', () => {
  it('records the edits this session makes', () => {
    const undoable = renderProducer();

    dispatchThrough(undoable(), { type: 'SCHEMA_UPDATE_ELEMENT', element: snapshot.flat.a });

    expect(undoable().canUndo).toBe(true);
  });

  it('drops everything when another session edits the space', () => {
    const undoable = renderProducer();

    dispatchThrough(undoable(), { type: 'SCHEMA_UPDATE_ELEMENT', element: snapshot.flat.a });
    expect(undoable().canUndo).toBe(true);

    dispatchThrough(undoable(), { type: 'SCHEMA_UPDATE', schema: snapshot, fromSubscriptions: true });

    // Every entry holds a whole-state snapshot: undoing one now would put the space back the way it was before the
    // other session's write and take that write with it.
    expect(undoable().canUndo).toBe(false);
  });

  it('does not record the queue putting back a rejected mutation', () => {
    const undoable = renderProducer();

    dispatchThrough(undoable(), { type: 'SCHEMA_UPDATE', schema: snapshot, queryFailed: true });

    expect(undoable().canUndo).toBe(false);
  });

  it('leaves an already empty history alone, however many remote edits arrive', () => {
    const undoable = renderProducer();
    const before = undoable();

    dispatchThrough(before, { type: 'SCHEMA_UPDATE', schema: snapshot, fromSubscriptions: true });
    dispatchThrough(undoable(), { type: 'SCHEMA_UPDATE', schema: snapshot, fromSubscriptions: true });

    // Same context value: clearing nothing must not re-render every consumer of the history.
    expect(undoable()).toBe(before);
  });
});
