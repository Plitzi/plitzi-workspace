import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import getDateGroup from '@pmodules/AI/helpers/getDateGroup';

import ConversationList from './components/ConversationList';
import HistoryFooter from './components/HistoryFooter';
import HistorySearch from './components/HistorySearch';

import type { ConversationGroup, EnrichedConversation } from './types';
import type { ConversationSummary } from '../../types';

export type HistoryPanelProps = {
  conversations: ConversationSummary[];
  currentConversationId?: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
};

const DATE_GROUP_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  older: 'Earlier'
};

const HistoryPanel = ({ conversations, currentConversationId, onClose, onSelect, onNew }: HistoryPanelProps) => {
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose]
  );

  const groups = useMemo<ConversationGroup[]>(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? conversations.filter(c => c.preview.toLowerCase().includes(q)) : conversations;

    const current = filtered.filter(c => c.id === currentConversationId);
    const others = filtered.filter(c => c.id !== currentConversationId);

    const result: ConversationGroup[] = [];
    let rowIndex = 0;

    const enrich = (items: ConversationSummary[], isCurrent: boolean): EnrichedConversation[] =>
      items.map(c => ({ ...c, rowIndex: rowIndex++, isCurrent }));

    if (current.length > 0) {
      result.push({ key: 'current', label: 'Active', items: enrich(current, true) });
    }

    const dateGroups = (['today', 'yesterday', 'week', 'older'] as const)
      .map(key => ({
        key,
        label: DATE_GROUP_LABELS[key],
        items: enrich(
          others.filter(c => getDateGroup(c.updatedAt) === key),
          false
        )
      }))
      .filter(g => g.items.length > 0);

    return [...result, ...dateGroups];
  }, [conversations, search, currentConversationId]);

  const flatList = useMemo<EnrichedConversation[]>(() => groups.flatMap(g => g.items), [groups]);

  useEffect(() => {
    setHighlighted(0);
  }, [search]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted(h => Math.min(h + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted(h => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatList.at(highlighted);
        if (item) {
          handleSelect(item.id);
        }
      } else if (/^[1-9]$/.test(e.key) && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const item = flatList.at(parseInt(e.key, 10) - 1);
        if (item) {
          handleSelect(item.id);
        }
      }
    };

    document.addEventListener('keydown', handler);

    return () => document.removeEventListener('keydown', handler);
  }, [onClose, flatList, highlighted, handleSelect]);

  return (
    <div ref={containerRef} className="flex grow basis-0 flex-col" onClick={handleClick}>
      <HistorySearch value={search} onChange={setSearch} />
      <ConversationList
        groups={groups}
        highlighted={highlighted}
        onHighlight={setHighlighted}
        onSelect={handleSelect}
      />
      <HistoryFooter onNew={onNew} />
    </div>
  );
};

export default HistoryPanel;
