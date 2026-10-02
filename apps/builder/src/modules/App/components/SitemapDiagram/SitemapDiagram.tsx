import Button from '@plitzi/plitzi-ui/Button';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import TreeCanvas from '@plitzi/plitzi-ui/TreeCanvas';
import { useCallback, useMemo, useState } from 'react';

import SitemapNode from './components/SitemapNode';
import schemaToSitemap from './helpers/schemaToSitemap';
import { ACCESS_LEVELS } from './types';

import type { ElementPage } from './helpers/schemaToSitemap';
import type { AccessLevel, SitemapEntry } from './types';
import type { TreeCanvasItem, TreeCanvasNodeState } from '@plitzi/plitzi-ui/TreeCanvas';
import type { Element, PageFolder } from '@plitzi/sdk-shared';

export type SitemapDiagramProps = {
  pages: Element[];
  pageFolders: PageFolder[];
  onAddNode?: (nodeType: 'page' | 'folder') => void;
  /** A page or folder dropped into a folder, or onto the top level (`null`). */
  onMove?: (entry: SitemapEntry, folderId: string | null) => void;
  onRemove?: (entry: SitemapEntry) => void;
  /** Back to the canvas: the map replaces it, and the Pages panel that opened it may be closed by now. */
  onClose?: () => void;
};

const toItems = (entries: SitemapEntry[]): TreeCanvasItem<SitemapEntry>[] =>
  entries.map(entry => ({
    id: entry.id,
    data: entry,
    container: entry.type === 'folder',
    children: entry.type === 'folder' ? toItems(entry.children) : undefined
  }));

const findEntry = (entries: SitemapEntry[], id: string): SitemapEntry | undefined => {
  for (const entry of entries) {
    if (entry.id === id) {
      return entry;
    }

    const found = entry.type === 'folder' ? findEntry(entry.children, id) : undefined;
    if (found) {
      return found;
    }
  }

  return undefined;
};

const LEGEND: AccessLevel[] = ['public', 'authenticated', 'none'];

/**
 * The site as a map: every folder over what it holds, laid out on its own. A page moves by dropping it onto a folder,
 * or onto the top level; it is removed with its bin or Delete.
 */
const SitemapDiagram = ({ pages, pageFolders, onAddNode, onMove, onRemove, onClose }: SitemapDiagramProps) => {
  const { addToast } = useToast();
  const { showDialog } = useModal();
  const [selectedId, setSelectedId] = useState<string>();
  // The page definitions are the pages this map draws; their attributes carry the fields `schemaToSitemap` reads.
  const entries = useMemo(() => schemaToSitemap(pages as ElementPage[], pageFolders), [pages, pageFolders]);
  const items = useMemo(() => toItems(entries), [entries]);

  const handleAddPage = useCallback(() => onAddNode?.('page'), [onAddNode]);
  const handleAddFolder = useCallback(() => onAddNode?.('folder'), [onAddNode]);

  const handleRemove = useCallback(
    async (entry: SitemapEntry) => {
      if (entry.type === 'folder' && entry.children.length > 0) {
        addToast('Move or remove what is inside this folder first.', {
          appeareance: 'warning',
          autoDismiss: true,
          placement: 'top-right'
        });

        return;
      }

      const kind = entry.type === 'folder' ? 'folder' : 'page';
      const confirmed = await showDialog(
        <Modal.Header>
          <h4>Remove {kind}</h4>
        </Modal.Header>,
        <Modal.Body>
          <p className="px-3 py-2 text-sm">
            Remove the {kind} <b>{entry.title}</b>?
          </p>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        entry.id
      );

      if (confirmed) {
        setSelectedId(undefined);
        onRemove?.(entry);
      }
    },
    [addToast, onRemove, showDialog]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const entry = findEntry(entries, id);
      if (entry) {
        void handleRemove(entry);
      }
    },
    [entries, handleRemove]
  );

  const handleMove = useCallback(
    (id: string, parentId: string | null) => {
      const entry = findEntry(entries, id);
      if (entry) {
        onMove?.(entry, parentId);
      }
    },
    [entries, onMove]
  );

  const renderNode = useCallback(
    (item: TreeCanvasItem<SitemapEntry>, state: TreeCanvasNodeState) => (
      <SitemapNode entry={item.data} selected={state.selected} dropTarget={state.dropTarget} onRemove={handleRemove} />
    ),
    [handleRemove]
  );

  return (
    <TreeCanvas<SitemapEntry>
      className="h-full w-full"
      ariaLabel="Sitemap"
      items={items}
      nodeWidth={220}
      nodeHeight={104}
      gapX={40}
      gapY={56}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onMove={onMove ? handleMove : undefined}
      onDelete={onRemove ? handleDelete : undefined}
      renderNode={renderNode}
      rootDropLabel="Move to the top level"
    >
      <div
        className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        onPointerDown={keepPress}
      >
        {onClose && (
          <Button size="sm" intent="secondary" title="Back to the canvas" onClick={onClose} iconPlacement="before">
            <Button.Icon icon="fa-solid fa-arrow-left" />
            Canvas
          </Button>
        )}
        <Button size="sm" onClick={handleAddPage} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          Page
        </Button>
        <Button size="sm" intent="secondary" onClick={handleAddFolder} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          Folder
        </Button>
        <span className="hidden pr-2 pl-1 text-xs text-gray-500 lg:inline dark:text-zinc-400">
          Drag a page onto a folder to move it
        </span>
      </div>
      <div
        className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        onPointerDown={keepPress}
      >
        <span className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
          Access
        </span>
        {LEGEND.map(level => (
          <span key={level} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
            <span className={`size-2 rounded-full ${ACCESS_LEVELS[level].dot}`} />
            {ACCESS_LEVELS[level].label}
          </span>
        ))}
      </div>
    </TreeCanvas>
  );
};

// A press on the toolbar or the legend is theirs, not the start of panning the map under them.
const keepPress = (e: { stopPropagation: () => void }) => e.stopPropagation();

export default SitemapDiagram;
