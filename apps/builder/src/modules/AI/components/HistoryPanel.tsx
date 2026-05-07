import { useEffect, useRef, useState } from 'react';

import type { ConversationSummary } from '../types';

const relativeTime = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getDateGroup = (dateStr: string): 'today' | 'yesterday' | 'week' | 'older' => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = diff / 86400000;
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 7) return 'week';
  return 'older';
};

const GROUP_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  older: 'Earlier'
};

type HistoryPanelProps = {
  conversations: ConversationSummary[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
};

const HistoryPanel = ({ conversations, onClose, onSelect, onNew }: HistoryPanelProps) => {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = search.trim()
    ? conversations.filter(c => c.preview?.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const groups = (['today', 'yesterday', 'week', 'older'] as const)
    .map(key => ({ key, label: GROUP_LABELS[key], items: filtered.filter(c => getDateGroup(c.updatedAt) === key) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-white dark:bg-zinc-950">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800/80">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Conversations</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-200"
          >
            <i className="fa-solid fa-plus text-[10px]" />
            New chat
          </button>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-300"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 py-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 transition-colors focus-within:border-zinc-300 focus-within:bg-white dark:border-zinc-700/80 dark:bg-zinc-900 dark:focus-within:border-zinc-600 dark:focus-within:bg-zinc-900">
          <i className="fa-solid fa-magnifying-glass shrink-0 text-[11px] text-zinc-400 dark:text-zinc-600" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="min-w-0 flex-1 bg-transparent text-xs text-zinc-700 placeholder-zinc-400 outline-none dark:text-zinc-300 dark:placeholder-zinc-600"
          />
          {search ? (
            <button
              onClick={() => setSearch('')}
              className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
            >
              <i className="fa-solid fa-xmark text-[10px]" />
            </button>
          ) : (
            <kbd className="shrink-0 rounded border border-zinc-200 px-1 font-mono text-[9px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <i
              className={`text-2xl text-zinc-300 dark:text-zinc-700 ${search ? 'fa-solid fa-magnifying-glass' : 'fa-regular fa-message'}`}
            />
            <span className="text-xs text-zinc-400 dark:text-zinc-600">
              {search ? 'No matches found' : 'No conversations yet'}
            </span>
          </div>
        ) : (
          groups.map(({ key, label, items }) => (
            <div key={key}>
              <div className="px-4 pb-1 pt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                {label}
              </div>
              {items.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelect(c.id);
                    onClose();
                  }}
                  className="group flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                >
                  <span className="mt-px h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-600 transition-colors group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                    {c.preview || '(empty conversation)'}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                    {relativeTime(c.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryPanel;
