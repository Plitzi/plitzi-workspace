import { useCallback, useEffect, useState } from 'react';

import ConversationList from './components/ConversationList';
import HistoryFooter from './components/HistoryFooter';
import HistorySearch from './components/HistorySearch';

import type { ConversationSummary } from '../../types';

export type HistoryPanelProps = {
  conversations: ConversationSummary[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
};

const HistoryPanel = ({ conversations, onClose, onSelect, onNew }: HistoryPanelProps) => {
  const [search, setSearch] = useState('');

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleClearSearch = useCallback(() => setSearch(''), []);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handler);

    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black/50 backdrop-blur-sm" onClick={handleClick}>
      <div className="absolute inset-x-2 top-12 bottom-2 flex flex-col overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <HistorySearch value={search} onChange={setSearch} onClear={handleClearSearch} />
        <ConversationList conversations={conversations} search={search} onSelect={handleSelect} />
        <HistoryFooter onNew={onNew} />
      </div>
    </div>
  );
};

export default HistoryPanel;
