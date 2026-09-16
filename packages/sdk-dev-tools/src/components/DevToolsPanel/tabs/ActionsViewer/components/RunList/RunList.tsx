import RunRow from '../RunRow';

import type { ActionRunEntry } from '@plitzi/sdk-shared';

export type RunListProps = {
  runs: ActionRunEntry[];
  /** Whether anything has run at all, as opposed to nothing matching the filter — two different empty states. */
  total: number;
  selectedRunId?: string;
  onSelect: (runId: string) => void;
  onCancel: (runId: string) => void;
};

const EMPTY_LOG =
  'No server action has run on this page yet. A run appears the moment one is SENT — including the ones that never come back — and the server adds the ones it ran to build the page.';

const RunList = ({ runs, total, selectedRunId, onSelect, onCancel }: RunListProps) => (
  <div className="flex min-w-0 grow flex-col overflow-auto">
    {total === 0 && <div className="p-3 text-[11px] text-zinc-500 dark:text-zinc-400">{EMPTY_LOG}</div>}
    {total > 0 && runs.length === 0 && (
      <div className="p-3 text-[11px] text-zinc-500 dark:text-zinc-400">No run matches this filter.</div>
    )}
    {runs.map(run => (
      <RunRow key={run.id} run={run} selected={run.id === selectedRunId} onSelect={onSelect} onCancel={onCancel} />
    ))}
  </div>
);

export default RunList;
