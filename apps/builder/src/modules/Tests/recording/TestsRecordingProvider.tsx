import { useCallback, useMemo, useRef, useState } from 'react';

import TestsRecordingContext from './TestsRecordingContext';

import type { RecordingDraft } from './TestsRecordingContext';
import type { Row } from '../helpers';
import type { ReactNode } from 'react';

export type TestsRecordingProviderProps = {
  /** The canvas shown, as a visitor sees it: where the steps are made. */
  onStart: () => void;
  /** The Tests view shown again, its form taking the recorded steps. */
  onStop: () => void;
  children: ReactNode;
};

/**
 * An e2e test's steps recorded in the canvas (RFC 0031): the form hands its test over, the canvas — in preview, as a
 * visitor uses it — records each click and each field changed as a step, and the form takes them back when it stops.
 */
const TestsRecordingProvider = ({ onStart, onStop, children }: TestsRecordingProviderProps) => {
  const [draft, setDraftState] = useState<RecordingDraft>();
  // The draft as last set, for `stop` to hand over without reading it through a state update.
  const current = useRef<RecordingDraft | undefined>(undefined);
  const setDraft = useCallback((next: RecordingDraft | undefined) => {
    current.current = next;
    setDraftState(next);
  }, []);
  const [recording, setRecording] = useState(false);
  const [expecting, setExpecting] = useState(false);
  const pending = useRef<RecordingDraft | undefined>(undefined);

  const start = useCallback(
    (next: RecordingDraft) => {
      setDraft(next);
      setRecording(true);
      onStart();
    },
    [onStart, setDraft]
  );
  const add = useCallback(
    (row: Row) => {
      if (current.current) {
        setDraft({ ...current.current, rows: [...current.current.rows, row] });
      }

      setExpecting(false);
    },
    [setDraft]
  );
  const stop = useCallback(() => {
    setRecording(false);
    setExpecting(false);
    pending.current = current.current;
    onStop();
  }, [onStop]);
  const take = useCallback(() => {
    const taken = pending.current;
    pending.current = undefined;
    setDraft(undefined);

    return taken;
  }, [setDraft]);

  const value = useMemo(
    () => ({ draft, recording, expecting, start, add, setExpecting, stop, take }),
    [add, draft, expecting, recording, start, stop, take]
  );

  return <TestsRecordingContext value={value}>{children}</TestsRecordingContext>;
};

export default TestsRecordingProvider;
