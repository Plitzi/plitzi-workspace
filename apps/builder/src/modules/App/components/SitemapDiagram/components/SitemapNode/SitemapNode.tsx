import clsx from 'clsx';
import { useCallback } from 'react';

import { ACCESS_LEVELS } from '../../types';
import SitemapChip, { SitemapAccessChip, SitemapFlagChip } from '../SitemapChip';
import SitemapPath from '../SitemapPath';

import type { SitemapEntry } from '../../types';
import type { MouseEvent, PointerEvent } from 'react';

export type SitemapNodeProps = {
  entry: SitemapEntry;
  selected: boolean;
  dropTarget: boolean;
  /** The page open in the canvas right now. */
  current: boolean;
  onOpen?: (id: string) => void;
  /** A new page, made inside this folder. */
  onAddPage?: (folderId: string) => void;
  onRemove: (entry: SitemapEntry) => void;
};

const ACTION =
  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';

const ACTION_DANGER =
  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-500/15 dark:hover:text-red-400';

// The card's buttons are pressed, not dragged: a press on one must not become the start of moving the card.
const keepPress = (e: PointerEvent) => e.stopPropagation();

/** One page or folder of the site: what it is called, where it answers, who may open it and what wraps it. */
const SitemapNode = ({ entry, selected, dropTarget, current, onOpen, onAddPage, onRemove }: SitemapNodeProps) => {
  const isFolder = entry.type === 'folder';
  const accent = entry.type === 'page' ? ACCESS_LEVELS[entry.access].accent : 'bg-amber-400';
  const icon = isFolder ? 'fa-regular fa-folder' : 'fa-regular fa-file';
  const removeTitle = isFolder ? 'Remove folder' : 'Remove page';
  const count = entry.type === 'folder' ? entry.children.length : 0;
  const itemsLabel = count === 1 ? '1 item' : `${count} items`;

  const handleRemove = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onRemove(entry);
    },
    [entry, onRemove]
  );

  const handleOpen = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onOpen?.(entry.id);
    },
    [entry.id, onOpen]
  );

  const handleAddPage = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onAddPage?.(entry.id);
    },
    [entry.id, onAddPage]
  );

  return (
    <div
      className={clsx(
        'group relative flex h-full flex-col gap-2 overflow-hidden rounded-xl border bg-white py-3 pr-2 pl-4 shadow-sm transition-colors dark:bg-zinc-900',
        {
          'border-primary-300 bg-primary-50/60 dark:border-primary-400/50 dark:bg-primary-400/10': dropTarget,
          'border-gray-200 hover:border-gray-300 dark:border-zinc-700 dark:hover:border-zinc-600': !dropTarget,
          'bg-amber-50/40 dark:bg-amber-500/5': isFolder && !dropTarget
        }
      )}
    >
      <span className={clsx('absolute inset-y-0 left-0 w-1', accent)} />
      <div className="flex items-start gap-2.5">
        <span
          className={clsx('flex size-8 shrink-0 items-center justify-center rounded-lg text-xs', {
            'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300': isFolder,
            'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400': !isFolder && !current,
            'bg-primary-500 dark:bg-primary-400 text-white': current
          })}
        >
          <i className={icon} />
        </span>
        <div className="flex min-w-0 grow flex-col">
          <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={entry.title}>
            {entry.title}
          </span>
          <SitemapPath path={entry.path} />
        </div>
        <div
          className={clsx('flex shrink-0 items-center', { 'opacity-0 group-hover:opacity-100': !selected })}
          onPointerDown={keepPress}
        >
          {entry.type === 'page' && onOpen && !current && (
            <button type="button" className={ACTION} title="Open in the canvas" onClick={handleOpen}>
              <i className="fa-solid fa-arrow-up-right-from-square text-[11px]" />
            </button>
          )}
          {isFolder && onAddPage && (
            <button type="button" className={ACTION} title="New page in this folder" onClick={handleAddPage}>
              <i className="fa-solid fa-plus text-[11px]" />
            </button>
          )}
          {selected && (
            <button type="button" className={ACTION_DANGER} title={removeTitle} onClick={handleRemove}>
              <i className="fa-regular fa-trash-can text-[11px]" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1.5 overflow-hidden">
        {entry.type === 'page' && (
          <>
            {current && (
              <SitemapChip
                icon="fa-solid fa-pen"
                className="border-primary-300 bg-primary-500 dark:border-primary-400 dark:bg-primary-400 text-white"
              >
                Editing
              </SitemapChip>
            )}
            {entry.isDefault && (
              <SitemapChip icon="fa-solid fa-house" title="The page the site opens on">
                Home
              </SitemapChip>
            )}
            <SitemapAccessChip page={entry} />
            {entry.layout && (
              <SitemapChip icon="fa-solid fa-border-all" title={`Inside the layout ${entry.layout}`}>
                {entry.layout}
              </SitemapChip>
            )}
            {entry.flag && <SitemapFlagChip gate={entry.flag} />}
          </>
        )}
        {entry.type === 'folder' && <span className="text-[11px] text-gray-500 dark:text-zinc-400">{itemsLabel}</span>}
      </div>
    </div>
  );
};

export default SitemapNode;
