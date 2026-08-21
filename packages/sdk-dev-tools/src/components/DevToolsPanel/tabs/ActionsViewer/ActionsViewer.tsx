import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { useCommonStore, useActionRuns } from '@plitzi/sdk-shared/store';

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

/**
 * The server actions this page has run.
 *
 * A page call that waits leaves its answer in the flow, so an author can bind it and see it. The other two modes
 * leave nothing: `detached` is not awaited and `stream` returns the moment the stream opens, so until this tab
 * existed the only evidence either of them happened was a line in the network tab — which says a POST was
 * answered and nothing about which action ran, what it was sent, or why it was refused.
 *
 * Where it can, it shows the SERVER's own steps: a dev server (and an authoring request) sends the trace back
 * with the answer, so the flow that ran on the other side is readable here, in the same panel as the client
 * flows that started it. A visitor's request never receives it, which is why it is only ever here in development.
 */
const ActionsViewer = () => {
  const { runs, clear } = useActionRuns();
  const [endpoint] = useCommonStore('actions.endpoint');
  const [expanded, setExpanded] = useState<string | undefined>();

  const handleToggle = useCallback((id: string) => () => setExpanded(current => (current === id ? undefined : id)), []);

  return (
    <div className="flex h-full w-full flex-col overflow-auto">
      <div className="flex items-center justify-between border-b border-gray-200 px-2 py-1 dark:border-zinc-700">
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          {endpoint
            ? `Server actions run at ${endpoint}`
            : 'This page is served without a Plitzi server: every action step is inert'}
        </span>
        <Button size="xs" disabled={runs.length === 0} onClick={clear}>
          Clear
        </Button>
      </div>
      {runs.length === 0 && (
        <div className="p-3 text-xs text-gray-500 dark:text-zinc-400">
          No server action has run on this page yet. A run appears the moment one is SENT — including the ones that
          never come back.
        </div>
      )}
      <div className="flex flex-col">
        {runs.map(run => (
          <div key={run.id} className="border-b border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-gray-50 dark:hover:bg-zinc-800"
              onClick={handleToggle(run.id)}
            >
              <span className="text-gray-400">{at(run.startedAt)}</span>
              <span className="font-medium">{run.actionId || '(no action named)'}</span>
              <span className="rounded-sm bg-gray-100 px-1 text-[10px] uppercase dark:bg-zinc-800">{run.mode}</span>
              <span className={clsx('ml-auto', TONE[run.status] ?? '')}>{run.reason ?? run.status}</span>
              <span className="text-gray-400">{took(run)}</span>
            </button>
            {expanded === run.id && (
              <div className="flex flex-col gap-2 bg-gray-50 px-3 py-2 text-xs dark:bg-zinc-800/50">
                {run.runId && (
                  <div>
                    <span className="text-gray-500 dark:text-zinc-400">Run id: </span>
                    <span className="font-mono">{run.runId}</span>
                  </div>
                )}
                {run.error && <div className="break-words text-red-600 dark:text-red-400">{run.error}</div>}
                <div>
                  <div className="text-gray-500 dark:text-zinc-400">Input</div>
                  <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(run.input ?? {}, null, 2)}</pre>
                </div>
                {run.output && (
                  <div>
                    <div className="text-gray-500 dark:text-zinc-400">Output</div>
                    <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(run.output, null, 2)}</pre>
                  </div>
                )}
                {run.progress.length > 0 && (
                  <div>
                    <div className="text-gray-500 dark:text-zinc-400">Progress ({run.progress.length})</div>
                    <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(run.progress, null, 2)}</pre>
                  </div>
                )}
                {/* The flow as it ran on the SERVER. Present in development only — a visitor's answer never
                    carries it, and that is the point rather than a limitation. */}
                {run.trace && (
                  <div className="flex flex-col gap-1">
                    <div className="text-gray-500 dark:text-zinc-400">Server steps</div>
                    {run.trace.map((step, index) => {
                      const node = step.node as { title?: string; action?: string } | undefined;
                      const status = typeof step.status === 'string' ? step.status : '';

                      return (
                        <div
                          key={`${String(node?.action)}-${index}`}
                          className="flex items-center justify-between rounded-sm border border-gray-200 px-2 py-1 dark:border-zinc-700"
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
