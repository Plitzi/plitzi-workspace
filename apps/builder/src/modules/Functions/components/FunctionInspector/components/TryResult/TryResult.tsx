import Alert from '@plitzi/plitzi-ui/Alert';
import clsx from 'clsx';

import type { ActionRunReport } from '@plitzi/sdk-shared';

export type TryResultProps = {
  report: ActionRunReport;
  /** The task that was tried: its step in the report is what it answered. */
  task: string;
};

/** What a try answered: how it ended and how long it took, what it logged, and its value — or why it failed. */
const TryResult = ({ report, task }: TryResultProps) => {
  const step = report.steps.find(entry => entry.action === task);
  const completed = report.status === 'completed';

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={clsx('rounded-sm px-1.5 py-0.5 font-medium', {
            'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300': completed,
            'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300': !completed
          })}
        >
          {report.status}
        </span>
        {step && <span className="text-gray-500 dark:text-zinc-400">{String(step.endTime - step.startTime)} ms</span>}
      </div>
      {step?.logs && step.logs.length > 0 && (
        <div className="flex flex-col gap-0.5 rounded-sm border border-gray-200 p-1.5 dark:border-zinc-700">
          <span className="text-[10px] font-medium tracking-wide text-gray-500 uppercase dark:text-zinc-400">Logs</span>
          {step.logs.map((line, index) => (
            <code key={`${String(index)} ${line}`} className="text-gray-600 dark:text-zinc-300">
              {line}
            </code>
          ))}
        </div>
      )}
      {step?.error && (
        <Alert intent="error" size="xs" solid={false}>
          {step.error}
        </Alert>
      )}
      {!step?.error && (
        <pre className="max-h-80 overflow-auto rounded-sm bg-gray-100 p-2 font-mono dark:bg-zinc-800">
          {JSON.stringify(report.output.value ?? null, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default TryResult;
