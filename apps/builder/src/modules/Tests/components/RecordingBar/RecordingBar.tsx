import Button from '@plitzi/plitzi-ui/Button';
import { use, useCallback } from 'react';

import TestsRecordingContext from '../../recording/TestsRecordingContext';

/**
 * Over the canvas while an e2e test is recorded: what it is, how many steps so far and the last of them, a switch for
 * the next click to hold what an element shows, and the way back to its form.
 */
const RecordingBar = () => {
  const { draft, recording, expecting, setExpecting, stop } = use(TestsRecordingContext);
  const handleExpect = useCallback(() => setExpecting(!expecting), [expecting, setExpecting]);
  if (!recording || !draft) {
    return null;
  }

  const last = draft.rows.at(-1);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-sm dark:border-red-900 dark:bg-red-950">
      <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
      <span className="font-medium text-zinc-900 dark:text-zinc-100">
        Recording “{draft.test.title || draft.test.id}”
      </span>
      <span className="text-gray-600 dark:text-zinc-400">
        {draft.rows.length} step{draft.rows.length === 1 ? '' : 's'}
        {last && ` · last: ${last.kind} ${typeof last.element === 'string' ? last.element : ''}`}
      </span>
      <div className="ml-auto flex gap-2">
        <Button size="sm" intent={expecting ? 'primary' : 'secondary'} onClick={handleExpect}>
          {expecting ? 'Click what must show…' : 'Click to expect'}
        </Button>
        <Button size="sm" intent="danger" onClick={stop}>
          Stop
        </Button>
      </div>
    </div>
  );
};

export default RecordingBar;
