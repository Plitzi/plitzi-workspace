import clsx from 'clsx';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import type { AiMode } from '@pmodules/AI/types';

export type ConversationButtonProps = {
  conversationTitle?: string;
  mode?: AiMode;
  onHistoryOpen: () => void;
};

const ConversationButton = ({ conversationTitle, mode, onHistoryOpen }: ConversationButtonProps) => {
  const { currentMode } = useAiChatContext();

  return (
    <button
      onClick={onHistoryOpen}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-left transition-colors hover:border-neutral-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
    >
      <span
        className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', {
          'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
          'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
        })}
      />
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
        {conversationTitle ?? 'New conversation'}
      </span>
      {mode && (
        <span
          className={clsx('shrink-0 rounded border px-1.5 py-px font-mono text-[8px] tracking-wider uppercase', {
            'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-400':
              currentMode === 'build',
            'border-sky-500/50 bg-sky-500/10 text-sky-500 dark:border-sky-400/50 dark:bg-sky-400/10 dark:text-sky-400':
              currentMode === 'plan'
          })}
        >
          {mode}
        </span>
      )}
      <kbd className="shrink-0 rounded border border-b-2 border-neutral-300 bg-neutral-100 px-1 py-px font-mono text-[8px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
        ⌘K
      </kbd>
    </button>
  );
};

export default ConversationButton;
