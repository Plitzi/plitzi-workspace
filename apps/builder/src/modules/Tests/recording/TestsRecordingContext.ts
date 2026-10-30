import { createContext } from 'react';

import type { Row } from '../helpers';
import type { E2eTest } from '@plitzi/sdk-shared';

/** An e2e test being written while its steps are recorded in the canvas: the test as the form left it, its rows so far. */
export type RecordingDraft = { test: E2eTest; rows: Row[] };

export type TestsRecordingValue = {
  /** The test being recorded, or the one whose recording just ended, waiting for its form to take it back. */
  draft?: RecordingDraft;
  /** Whether the canvas is recording now. */
  recording: boolean;
  /** Whether the next click records what the element shows, instead of pressing it. */
  expecting: boolean;
  start: (draft: RecordingDraft) => void;
  add: (row: Row) => void;
  setExpecting: (expecting: boolean) => void;
  stop: () => void;
  /** The draft whose recording ended, handed to its form once — and forgotten. */
  take: () => RecordingDraft | undefined;
};

const TestsRecordingContext = createContext<TestsRecordingValue>({
  recording: false,
  expecting: false,
  start: () => undefined,
  add: () => undefined,
  setExpecting: () => undefined,
  stop: () => undefined,
  take: () => undefined
});

export default TestsRecordingContext;
