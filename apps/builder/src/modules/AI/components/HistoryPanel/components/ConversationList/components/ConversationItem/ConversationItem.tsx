import clsx from 'clsx';
import { useCallback } from 'react';

import relativeTime from '@pmodules/AI/helpers/relativeTime';

import type { EnrichedConversation } from '@pmodules/AI/components/HistoryPanel/types';

export type ConversationItemProps = {
  conversation: EnrichedConversation;
  rowNum: number;
  isHighlighted: boolean;
  isCurrent: boolean;
  onSelect: (id: string) => void;
  onHighlight: (index: number) => void;
};

const ConversationItem = ({
  conversation,
  rowNum,
  isHighlighted,
  isCurrent,
  onSelect,
  onHighlight
}: ConversationItemProps) => {
  const handleClick = useCallback(() => onSelect(conversation.id), [conversation.id, onSelect]);
  const handleMouseEnter = useCallback(() => onHighlight(conversation.rowIndex), [conversation.rowIndex, onHighlight]);

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={clsx(
        'group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
        isHighlighted
          ? 'bg-neutral-100 dark:bg-zinc-800'
          : 'text-zinc-700 hover:bg-neutral-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50'
      )}
    >
      <span
        className={clsx(
          'grid h-5 w-5 shrink-0 place-items-center rounded border font-mono text-[9px] font-semibold transition-colors',
          isHighlighted
            ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400/60 dark:bg-emerald-400/10 dark:text-emerald-400'
            : 'border-neutral-300 bg-neutral-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-600'
        )}
      >
        {rowNum <= 9 ? rowNum : '·'}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {isCurrent && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.8)] dark:bg-emerald-400" />
          )}
          <span
            className={clsx(
              'block truncate text-[12px] font-medium',
              isHighlighted ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'
            )}
          >
            {conversation.preview || '(empty conversation)'}
          </span>
        </span>
      </span>

      <span className="shrink-0 font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
        {relativeTime(conversation.updatedAt)}
      </span>
    </button>
  );
};

export default ConversationItem;
