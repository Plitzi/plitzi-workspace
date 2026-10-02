import clsx from 'clsx';
import { useCallback } from 'react';

import { ACCESS_LEVELS } from '../../types';

import type { SitemapEntry } from '../../types';
import type { PointerEvent } from 'react';

export type SitemapNodeProps = {
  entry: SitemapEntry;
  selected: boolean;
  dropTarget: boolean;
  onRemove: (entry: SitemapEntry) => void;
};

// The bin is pressed, not dragged: a press on it must not become the start of moving the card.
const keepPress = (e: PointerEvent) => e.stopPropagation();

/** One page or folder of the site: what it is called, where it answers, and who may open it. */
const SitemapNode = ({ entry, selected, dropTarget, onRemove }: SitemapNodeProps) => {
  const access = ACCESS_LEVELS[entry.accessLevel];
  const isFolder = entry.type === 'folder';

  const handleRemove = useCallback(() => onRemove(entry), [entry, onRemove]);

  return (
    <div
      className={clsx(
        'flex h-full flex-col gap-2 rounded-xl border bg-white p-3 shadow-sm transition-colors dark:bg-zinc-900',
        {
          'border-primary-300 bg-primary-50/60 dark:border-primary-400/50 dark:bg-primary-400/10': dropTarget,
          'border-gray-200 hover:border-gray-300 dark:border-zinc-700 dark:hover:border-zinc-600': !dropTarget
        }
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={clsx('flex size-8 shrink-0 items-center justify-center rounded-lg text-xs', {
            'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300': isFolder,
            'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400': !isFolder
          })}
        >
          <i className={isFolder ? 'fa-regular fa-folder' : 'fa-regular fa-file'} />
        </span>
        <div className="flex min-w-0 grow flex-col">
          <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{entry.title}</span>
          {entry.path && (
            <span className="truncate font-mono text-[11px] text-gray-500 dark:text-zinc-400">{entry.path}</span>
          )}
        </div>
        {selected && (
          <button
            type="button"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
            title={isFolder ? 'Remove folder' : 'Remove page'}
            onPointerDown={keepPress}
            onClick={handleRemove}
          >
            <i className="fa-regular fa-trash-can text-xs" />
          </button>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {!isFolder && (
          <span
            className={clsx(
              'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              access.badge
            )}
          >
            <i className={clsx(access.icon, 'text-[9px]')} />
            {access.label}
          </span>
        )}
        {entry.type === 'page' && entry.isDefault && (
          <span className="border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-400/30 dark:bg-primary-400/10 dark:text-primary-200 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
            <i className="fa-solid fa-house text-[9px]" />
            Home
          </span>
        )}
        {isFolder && (
          <span className="text-[11px] text-gray-500 dark:text-zinc-400">
            {entry.children.length === 1 ? '1 item' : `${entry.children.length} items`}
          </span>
        )}
      </div>
    </div>
  );
};

export default SitemapNode;
