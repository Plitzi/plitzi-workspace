import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAiChatContext } from '../contexts/AiChatContext';
import getDateGroup from '../helpers/getDateGroup';
import relativeTime from '../helpers/relativeTime';

import type { ConversationSummary } from '../types';

const GROUP_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  older: 'Earlier'
};

export type HistoryPanelProps = {
  conversations: ConversationSummary[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
};

const HistoryPanel = ({ conversations, onClose, onSelect, onNew }: HistoryPanelProps) => {
  const { currentMode } = useAiChatContext();
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 60);

    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handler);

    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = search.trim()
    ? conversations.filter(c => c.preview.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const groups = (['today', 'yesterday', 'week', 'older'] as const)
    .map(key => ({ key, label: GROUP_LABELS[key], items: filtered.filter(c => getDateGroup(c.updatedAt) === key) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black/50 backdrop-blur-sm" onClick={handleClick}>
      <div className="absolute inset-x-2 top-12 bottom-2 flex flex-col overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Search */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
            <i className="fa-solid fa-magnifying-glass shrink-0 text-[11px] text-zinc-400 dark:text-zinc-600" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-600"
            />
            {search ? (
              <button onClick={() => setSearch('')} className="shrink-0 text-zinc-400 dark:text-zinc-600">
                <i className="fa-solid fa-xmark text-[10px]" />
              </button>
            ) : (
              <kbd className="shrink-0 rounded border border-b-2 border-neutral-300 bg-neutral-100 px-1 py-px font-mono text-[9px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-600">
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
                className={clsx(
                  'text-xl text-zinc-400 dark:text-zinc-600',
                  search ? 'fa-solid fa-magnifying-glass' : 'fa-regular fa-message'
                )}
              />
              <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
                {search ? 'No matches found' : 'No conversations yet'}
              </span>
            </div>
          ) : (
            groups.map(({ key, label, items }) => (
              <div key={key}>
                <div className="px-4 pt-3 pb-1 font-mono text-[9px] tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                  {label}
                </div>
                {items.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelect(c.id);
                      onClose();
                    }}
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
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-neutral-200 bg-neutral-100 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            onClick={onNew}
            className={clsx(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors hover:bg-neutral-100 dark:hover:bg-zinc-800',
              {
                'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-400':
                  currentMode === 'build',
                'border-sky-500/50 bg-sky-500/10 text-sky-500 dark:border-sky-400/50 dark:bg-sky-400/10 dark:text-sky-400':
                  currentMode === 'plan'
              }
            )}
          >
            <i className="fa-solid fa-plus text-[9px]" />
            New chat
          </button>
          <div className="flex items-center gap-3 font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
            <span>
              <kbd className="mr-1 rounded border border-b-2 border-neutral-300 bg-neutral-50 px-1 py-px dark:border-zinc-700 dark:bg-zinc-800">
                ↵
              </kbd>
              open
            </span>
            <span>
              <kbd className="mr-1 rounded border border-b-2 border-neutral-300 bg-neutral-50 px-1 py-px dark:border-zinc-700 dark:bg-zinc-800">
                esc
              </kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
