import { useCallback } from 'react';

import InspectorSection from './components/InspectorSection';
import TaskTest from './components/TaskTest';
import TimeLimit from './components/TimeLimit';
import { cpuOf, taskNameOf } from '../../helpers';

import type { ListedTask } from '../../helpers';
import type { ActionRunReport, FunctionTimeLimits } from '@plitzi/sdk-shared';

export type FunctionInspectorProps = {
  task: ListedTask;
  /** What every task gets unless it asks for its own, from `defineFunctions`. */
  sharedLimits?: FunctionTimeLimits;
  hosts: string[];
  /** Why its limits cannot be written for you right now — the code is still being read, say — or nothing. */
  limitsDisabledReason: string;
  /** The code differs from the saved draft. */
  modified: boolean;
  onLimitsChange: (task: ListedTask, cpuMs: number | undefined) => void;
  onRun: (task: string, params: Record<string, unknown>) => Promise<ActionRunReport | undefined>;
};

/**
 * The selected task: what it is as a step, how much CPU a run of it may use — written into its code — and a run of it
 * in the sandbox, saving first when the code changed.
 */
const FunctionInspector = ({
  task,
  sharedLimits,
  hosts,
  limitsDisabledReason,
  modified,
  onLimitsChange,
  onRun
}: FunctionInspectorProps) => {
  const name = taskNameOf(task);
  const cpu = cpuOf(task, sharedLimits);

  const handleLimit = useCallback((cpuMs: number | undefined) => onLimitsChange(task, cpuMs), [onLimitsChange, task]);

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-auto border-l border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex flex-col gap-1 border-b border-gray-200 px-4 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200 flex size-6 shrink-0 items-center justify-center rounded-md">
            <i className="fa-solid fa-bolt text-[11px]" />
          </span>
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-50">{task.title || name}</span>
          {!task.saved && (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Not saved
            </span>
          )}
        </div>
        <code className="text-xs text-gray-500 dark:text-zinc-400">{name}</code>
        {task.description && (
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-zinc-300">{task.description}</p>
        )}
      </header>
      <InspectorSection title="Time limit">
        <TimeLimit ms={cpu.ms} asked={cpu.asked} disabledReason={limitsDisabledReason} onChange={handleLimit} />
      </InspectorSection>
      <InspectorSection title="Test" hint="Runs in the sandbox as you: its fetches and writes are real.">
        <TaskTest key={name} task={task} needsSave={modified || !task.saved} onRun={onRun} />
      </InspectorSection>
      <InspectorSection title="Hosts it may reach" hint="Every task’s ctx.fetch: anything else is refused.">
        {hosts.length === 0 && (
          <span className="text-xs text-gray-500 dark:text-zinc-400">None — no fetch leaves.</span>
        )}
        <div className="flex flex-wrap gap-1">
          {hosts.map(host => (
            <code
              key={host}
              className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {host}
            </code>
          ))}
        </div>
      </InspectorSection>
    </aside>
  );
};

export default FunctionInspector;
