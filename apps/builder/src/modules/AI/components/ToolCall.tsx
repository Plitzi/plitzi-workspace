import type { AiToolCall } from '../types';

const ToolCall = ({ name, args, status }: AiToolCall) => {
  const argPreview =
    args && Object.keys(args).length > 0
      ? `(${Object.entries(args)
          .slice(0, 2)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join(', ')})`
      : '';

  return (
    <div className="flex items-center gap-2 py-0.5 pl-4 font-mono text-xs">
      {status === 'running' ? (
        <span className="animate-spin text-amber-400">⚙</span>
      ) : (
        <span className="text-emerald-400">✓</span>
      )}
      <span className={status === 'running' ? 'text-amber-300' : 'text-zinc-500'}>{name}</span>
      {argPreview && <span className="truncate text-zinc-600">{argPreview}</span>}
    </div>
  );
};

export default ToolCall;
