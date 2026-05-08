import clsx from 'clsx';
import { useCallback } from 'react';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';
import relativeTime from '@pmodules/AI/helpers/relativeTime';

import type { ConversationSummary } from '@pmodules/AI/types';

export type ConversationItemProps = {
  conversation: ConversationSummary;
  onSelect: (id: string) => void;
};

const ConversationItem = ({ conversation, onSelect }: ConversationItemProps) => {
  const { currentMode } = useAiChatContext();
  const handleClick = useCallback(() => onSelect(conversation.id), [conversation.id, onSelect]);

  return (
    <button
      onClick={handleClick}
      className="group flex w-full items-center gap-3 px-4 py-2 text-left text-zinc-700 transition-colors hover:bg-neutral-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <span
        className={clsx('mt-px h-1.5 w-1.5 shrink-0 rounded-full', {
          'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
          'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
        })}
      />
      <span className="min-w-0 flex-1 truncate text-[12px]">{conversation.preview || '(empty conversation)'}</span>
      <span className="shrink-0 font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
        {relativeTime(conversation.updatedAt)}
      </span>
    </button>
  );
};

export default ConversationItem;
