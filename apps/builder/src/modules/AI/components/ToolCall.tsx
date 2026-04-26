import type { AiToolCall } from '../types';

const ToolCall = ({ name, args, status }: AiToolCall) => {
  const argPreview =
    args && Object.keys(args).length > 0
      ? Object.entries(args)
          .slice(0, 2)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join('  ')
      : '';

  return (
    <div className="flex min-w-0 items-center gap-2 py-0.5 pl-3 font-mono text-xs">
      <span className="shrink-0">
        {status === 'running' ? (
          <span className="animate-spin text-amber-500 dark:text-amber-400">⚙</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400">✓</span>
        )}
      </span>
      <span
        className={`shrink-0 ${status === 'running' ? 'text-amber-600 dark:text-amber-300' : 'text-zinc-500 dark:text-zinc-400'}`}
      >
        {name}
      </span>
      {argPreview && <span className="min-w-0 truncate text-zinc-400 dark:text-zinc-600">{argPreview}</span>}
    </div>
  );
};

export default ToolCall;
