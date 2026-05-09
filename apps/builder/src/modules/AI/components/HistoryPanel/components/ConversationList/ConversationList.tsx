import ConversationItem from './components/ConversationItem';

import type { ConversationGroup } from '@pmodules/AI/components/HistoryPanel/types';

export type ConversationListProps = {
  groups: ConversationGroup[];
  highlighted: number;
  onHighlight: (index: number) => void;
  onSelect: (id: string) => void;
};

const ConversationList = ({ groups, highlighted, onHighlight, onSelect }: ConversationListProps) => {
  const isEmpty = groups.every(g => g.items.length === 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {isEmpty && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <i className="fa-regular fa-message text-xl text-zinc-400 dark:text-zinc-600" />
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">No conversations yet</span>
        </div>
      )}
      {!isEmpty &&
        groups.map(({ key, label, items }) => (
          <div key={key}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              <span className="font-mono text-[9px] tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                {label}
              </span>
              <span className="font-mono text-[9px] text-zinc-300 dark:text-zinc-700">{items.length}</span>
            </div>
            {items.map(c => (
              <ConversationItem
                key={c.id}
                conversation={c}
                rowNum={c.rowIndex + 1}
                isHighlighted={c.rowIndex === highlighted}
                isCurrent={c.isCurrent}
                onSelect={onSelect}
                onHighlight={onHighlight}
              />
            ))}
          </div>
        ))}
    </div>
  );
};

export default ConversationList;
