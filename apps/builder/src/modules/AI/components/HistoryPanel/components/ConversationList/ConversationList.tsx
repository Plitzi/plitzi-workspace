import clsx from 'clsx';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';
import getDateGroup from '@pmodules/AI/helpers/getDateGroup';
import relativeTime from '@pmodules/AI/helpers/relativeTime';

import { GROUP_LABELS } from '../../helpers';

import type { ConversationSummary } from '@pmodules/AI/types';

export type ConversationListProps = {
  conversations: ConversationSummary[];
  search: string;
  onSelect: (id: string) => void;
};

const ConversationList = ({ conversations, search, onSelect }: ConversationListProps) => {
  const { currentMode } = useAiChatContext();

  const filtered = search.trim()
    ? conversations.filter(c => c.preview.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const groups = (['today', 'yesterday', 'week', 'older'] as const)
    .map(key => ({ key, label: GROUP_LABELS[key], items: filtered.filter(c => getDateGroup(c.updatedAt) === key) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {groups.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <i
            className={clsx('text-xl text-zinc-400 dark:text-zinc-600', {
              'fa-solid fa-magnifying-glass': !!search,
              'fa-regular fa-message': !search
            })}
          />
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
            {search ? 'No matches found' : 'No conversations yet'}
          </span>
        </div>
      )}
      {groups.length > 0 &&
        groups.map(({ key, label, items }) => (
          <div key={key}>
            <div className="px-4 pt-3 pb-1 font-mono text-[9px] tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
              {label}
            </div>
            {items.map(c => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className="group flex w-full items-center gap-3 px-4 py-2 text-left text-zinc-700 transition-colors hover:bg-neutral-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <span
                  className={clsx('mt-px h-1.5 w-1.5 shrink-0 rounded-full', {
                    'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
                    'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
                  })}
                />
                <span className="min-w-0 flex-1 truncate text-[12px]">{c.preview || '(empty conversation)'}</span>
                <span className="shrink-0 font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
                  {relativeTime(c.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        ))}
    </div>
  );
};

export default ConversationList;
