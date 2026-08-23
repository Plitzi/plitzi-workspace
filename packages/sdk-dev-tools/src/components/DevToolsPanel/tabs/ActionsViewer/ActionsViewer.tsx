import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { cancelActionRun, useCommonStore, useActionRuns } from '@plitzi/sdk-shared/store';

import type { ActionRunEntry } from '@plitzi/sdk-shared';

const TONE: Record<string, string> = {
  running: 'text-blue-600 dark:text-blue-400',
  streaming: 'text-blue-600 dark:text-blue-400',
  accepted: 'text-blue-600 dark:text-blue-400',
  completed: 'text-green-700 dark:text-green-400',
  failed: 'text-red-600 dark:text-red-400',
  aborted: 'text-amber-600 dark:text-amber-400',
  skipped: 'text-zinc-500'
};

const at = (value: number) => new Date(value).toLocaleTimeString();

const took = (run: ActionRunEntry) => (run.endedAt ? `${run.endedAt - run.startedAt}ms` : '…');

/** Still happening: no end time, and the step that started it still holds the handle. */
const isLive = (run: ActionRunEntry) => run.endedAt === undefined;

/** Server action runs; `detached` and `stream` modes leave no other trace in the UI. */
const ActionsViewer = () => {
  const { runs, clear } = useActionRuns();
  const [endpoint] = useCommonStore('actions.endpoint');
  const [expanded, setExpanded] = useState<string | undefined>();
  const live = runs.filter(isLive);

  const handleToggle = useCallback((id: string) => () => setExpanded(current => (current === id ? undefined : id)), []);

  const handleCancel = useCallback((id: string) => () => cancelActionRun(id), []);

  return (
    <div className="flex h-full w-full flex-col overflow-auto">
      <div className="flex items-center justify-between border-b border-zinc-200 px-2 py-1 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          {live.length > 0 && (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <i className="fa-solid fa-circle-notch fa-spin" />
              {live.length} running
            </span>
          )}
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {endpoint
              ? `Server actions run at ${endpoint}`
              : 'This page is served without a Plitzi server: every action step is inert'}
          </span>
        </div>
        <Button size="xs" disabled={runs.length === 0} onClick={clear}>
          Clear
        </Button>
      </div>
      {runs.length === 0 && (
        <div className="p-3 text-xs text-zinc-500 dark:text-zinc-400">
          No server action has run on this page yet. A run appears the moment one is SENT — including the ones that
          never come back.
        </div>
      )}
      <div className="flex flex-col">
        {runs.map(run => (
          <div key={run.id} className="border-b border-zinc-100 dark:border-zinc-800">
            {/* Cancel sits beside the toggle row: nested buttons are invalid markup. */}
            <div className="flex w-full items-center gap-2 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <button
                type="button"
                className="flex grow items-center gap-2 py-1 text-left text-xs"
                onClick={handleToggle(run.id)}
              >
                <span className="text-zinc-400 dark:text-zinc-500">{at(run.startedAt)}</span>
                <span className="font-medium">{run.actionId || '(no action named)'}</span>
                <span className="rounded-sm bg-zinc-100 px-1 text-[10px] uppercase dark:bg-zinc-800">{run.mode}</span>
                <span className={clsx('ml-auto', TONE[run.status] ?? '')}>{run.reason ?? run.status}</span>
                <span className="text-zinc-400 dark:text-zinc-500">{took(run)}</span>
              </button>
              {isLive(run) && run.cancellable && (
                <Button size="xs" intent="secondary" onClick={handleCancel(run.id)}>
                  Cancel
                </Button>
              )}
            </div>
            {expanded === run.id && (
              <div className="flex flex-col gap-2 bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/50">
                {run.runId && (
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Run id: </span>
                    <span className="font-mono">{run.runId}</span>
                  </div>
                )}
                {run.error && <div className="break-words text-red-600 dark:text-red-400">{run.error}</div>}
                <div>
                  <div className="text-zinc-500 dark:text-zinc-400">Input</div>
                  <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(run.input ?? {}, null, 2)}</pre>
                </div>
                {run.output && (
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400">Output</div>
                    <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(run.output, null, 2)}</pre>
                  </div>
                )}
                {run.progress.length > 0 && (
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400">Progress ({run.progress.length})</div>
                    <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(run.progress, null, 2)}</pre>
                  </div>
                )}
                {/* Server-side steps; a visitor's answer never carries them, so this only appears in development. */}
                {run.trace && (
                  <div className="flex flex-col gap-1">
                    <div className="text-zinc-500 dark:text-zinc-400">Server steps</div>
                    {run.trace.map((step, index) => {
                      const node = step.node as { title?: string; action?: string } | undefined;
                      const status = typeof step.status === 'string' ? step.status : '';

                      return (
                        <div
                          key={`${String(node?.action)}-${index}`}
                          className="flex items-center justify-between rounded-sm border border-zinc-200 px-2 py-1 dark:border-zinc-700"
                        >
                          <span>{node?.title ?? node?.action ?? 'step'}</span>
                          <span className={clsx(TONE[status === 'success' ? 'completed' : 'failed'])}>{status}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionsViewer;
