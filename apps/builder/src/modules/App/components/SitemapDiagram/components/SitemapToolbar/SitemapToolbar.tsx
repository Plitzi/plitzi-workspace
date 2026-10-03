import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback } from 'react';

import type { KeyboardEvent, PointerEvent } from 'react';

export type SitemapToolbarProps = {
  pageCount: number;
  folderCount: number;
  query: string;
  /** How many entries the query found, and which of them is being shown. */
  matchCount: number;
  matchIndex: number;
  onQueryChange: (query: string) => void;
  onNextMatch: (backwards: boolean) => void;
  onAddPage: () => void;
  onAddFolder: () => void;
  onClose?: () => void;
};

// A press on the toolbar is the toolbar's, not the start of panning the map under it.
const keepPress = (e: PointerEvent) => e.stopPropagation();

/** Back to the canvas, what the site holds, a search across it, and the two things made from here. */
const SitemapToolbar = ({
  pageCount,
  folderCount,
  query,
  matchCount,
  matchIndex,
  onQueryChange,
  onNextMatch,
  onAddPage,
  onAddFolder,
  onClose
}: SitemapToolbarProps) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Enter walks the matches, Escape gives the keys back to the map; neither is the map's while typing.
      e.stopPropagation();
      if (e.key === 'Enter') {
        onNextMatch(e.shiftKey);
      } else if (e.key === 'Escape') {
        onQueryChange('');
      }
    },
    [onNextMatch, onQueryChange]
  );

  const pages = pageCount === 1 ? '1 page' : `${pageCount} pages`;
  const folders = folderCount === 1 ? '1 folder' : `${folderCount} folders`;
  const matches = matchCount === 0 ? 'No match' : `${matchIndex + 1} of ${matchCount}`;

  return (
    <div
      className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-xl border border-gray-200 bg-white/95 p-1.5 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95"
      onPointerDown={keepPress}
    >
      {onClose && (
        <Button size="sm" intent="secondary" title="Back to the canvas" onClick={onClose} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-arrow-left" />
          Canvas
        </Button>
      )}
      <div className="flex w-56 items-center gap-2" onKeyDown={handleKeyDown}>
        <Input
          className="grow"
          size="sm"
          placeholder="Find a page"
          value={query}
          onChange={onQueryChange}
          title="Enter for the next match, Shift+Enter for the previous one"
        >
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
      </div>
      {query && <span className="min-w-14 text-xs text-gray-500 tabular-nums dark:text-zinc-400">{matches}</span>}
      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-zinc-700" />
      <Button size="sm" onClick={onAddPage} iconPlacement="before">
        <Button.Icon icon="fa-solid fa-plus" />
        Page
      </Button>
      <Button size="sm" intent="secondary" onClick={onAddFolder} iconPlacement="before">
        <Button.Icon icon="fa-solid fa-folder-plus" />
        Folder
      </Button>
      <span className="hidden px-1 text-xs text-gray-500 xl:inline dark:text-zinc-400">
        {pages} · {folders}
      </span>
    </div>
  );
};

export default SitemapToolbar;
