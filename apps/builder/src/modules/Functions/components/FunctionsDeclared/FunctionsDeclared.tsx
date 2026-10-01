import { FUNCTION_ROUTES_PREFIX } from '@plitzi/sdk-shared/actions';

import TaskCard from './components/TaskCard';
import { limitsLabel, routeParts, taskNameOf } from '../../helpers';

import type { FunctionsManifest } from '@plitzi/sdk-shared';

export type FunctionsDeclaredProps = {
  manifest: FunctionsManifest;
  /** The task Try is set to. */
  selected: string;
  onTry: (task: string) => void;
};

/**
 * What the saved code declares — its steps, its routes and every host it may reach — so whoever reviews the space sees
 * what it does and where it goes without reading the code. A step is a click from being tried.
 */
const FunctionsDeclared = ({ manifest, selected, onTry }: FunctionsDeclaredProps) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-2">
      <div className="flex flex-col">
        <span className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-zinc-400">Tasks</span>
        <span className="text-[11px] text-gray-500 dark:text-zinc-400">Steps in the action editor’s catalog</span>
      </div>
      {manifest.tasks.length === 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">None yet: each one in tasks becomes a step.</span>
      )}
      {manifest.tasks.map(task => (
        <TaskCard
          key={taskNameOf(task)}
          name={taskNameOf(task)}
          title={task.title}
          description={task.description}
          limits={limitsLabel(task, manifest)}
          selected={taskNameOf(task) === selected}
          onTry={onTry}
        />
      ))}
    </div>
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-zinc-400">Routes</span>
      {manifest.routes.length === 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          None — routes answer HTTP under {FUNCTION_ROUTES_PREFIX}
        </span>
      )}
      {manifest.routes.map(route => (
        <div key={route} className="flex items-center gap-2 text-xs">
          <span className="rounded-sm bg-gray-100 px-1 py-0.5 font-mono text-[10px] font-semibold dark:bg-zinc-800">
            {routeParts(route, FUNCTION_ROUTES_PREFIX).method}
          </span>
          <code className="truncate">{routeParts(route, FUNCTION_ROUTES_PREFIX).path}</code>
        </div>
      ))}
    </div>
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-zinc-400">
        Hosts it may reach
      </span>
      {manifest.hosts.length === 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">None — no fetch leaves</span>
      )}
      {manifest.hosts.map(host => (
        <code key={host} className="text-xs">
          {host}
        </code>
      ))}
    </div>
  </div>
);

export default FunctionsDeclared;
