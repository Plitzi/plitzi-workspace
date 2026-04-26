import type { ReactNode } from 'react';

type AiChatHeaderProps = {
  onClear: () => void;
  isStreaming: boolean;
  badge?: string;
  extra?: ReactNode;
};

const AiChatHeader = ({ onClear, isStreaming, badge, extra }: AiChatHeaderProps) => (
  <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-zinc-800">
    <div className="flex items-center gap-2">
      <span className="text-sm text-violet-500 dark:text-violet-400">◆</span>
      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">AI Assistant</span>
      {badge && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
          {badge}
        </span>
      )}
    </div>
    <div className="flex items-center gap-3">
      {extra}
      <button
        className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
        onClick={onClear}
        disabled={isStreaming}
        title="New conversation"
      >
        ✕ new
      </button>
    </div>
  </div>
);

export default AiChatHeader;
