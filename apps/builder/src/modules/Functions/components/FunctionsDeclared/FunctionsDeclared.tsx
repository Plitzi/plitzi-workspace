import type { FunctionsManifest } from '@plitzi/sdk-shared';

export type FunctionsDeclaredProps = {
  manifest: FunctionsManifest;
};

/**
 * What the saved code declares — its steps, its routes and every host it may reach — so whoever reviews the space sees
 * what it does and where it goes without reading the code.
 */
const FunctionsDeclared = ({ manifest }: FunctionsDeclaredProps) => (
  <div className="flex flex-col gap-2 rounded-sm border border-gray-300 p-3 text-xs dark:border-zinc-600">
    <span className="text-sm font-medium">Declared</span>
    <div className="flex flex-col gap-1">
      <span className="text-gray-500 dark:text-zinc-400">Steps, in the action editor’s catalog</span>
      {manifest.tasks.length === 0 && <span className="text-gray-500 dark:text-zinc-400">None</span>}
      {manifest.tasks.map(task => (
        <span key={`${task.namespace}.${task.action}`}>
          <code>
            {task.namespace}.{task.action}
          </code>{' '}
          — {task.title}
        </span>
      ))}
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-gray-500 dark:text-zinc-400">Routes, under /api</span>
      {manifest.routes.length === 0 && <span className="text-gray-500 dark:text-zinc-400">None</span>}
      {manifest.routes.map(route => (
        <code key={route}>{route}</code>
      ))}
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-gray-500 dark:text-zinc-400">Hosts it may reach</span>
      {manifest.hosts.length === 0 && <span className="text-gray-500 dark:text-zinc-400">None — no fetch leaves</span>}
      {manifest.hosts.map(host => (
        <code key={host}>{host}</code>
      ))}
    </div>
  </div>
);

export default FunctionsDeclared;
