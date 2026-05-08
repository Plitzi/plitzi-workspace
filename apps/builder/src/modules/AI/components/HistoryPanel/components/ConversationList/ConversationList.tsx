import clsx from 'clsx';

import getDateGroup from '@pmodules/AI/helpers/getDateGroup';

import { GROUP_LABELS } from '../../helpers';
import ConversationItem from './components/ConversationItem';

import type { ConversationSummary } from '@pmodules/AI/types';

export type ConversationListProps = {
  conversations: ConversationSummary[];
  search: string;
  onSelect: (id: string) => void;
};

const ConversationList = ({ conversations, search, onSelect }: ConversationListProps) => {
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
              <ConversationItem key={c.id} conversation={c} onSelect={onSelect} />
            ))}
          </div>
        ))}
    </div>
  );
};

export default ConversationList;
