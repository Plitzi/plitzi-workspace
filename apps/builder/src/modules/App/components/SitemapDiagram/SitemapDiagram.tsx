import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import TreeCanvas from '@plitzi/plitzi-ui/TreeCanvas';
import { useCallback, useMemo, useState } from 'react';

import SitemapLegend from './components/SitemapLegend';
import SitemapNode from './components/SitemapNode';
import SitemapToolbar from './components/SitemapToolbar';
import schemaToSitemap from './helpers/schemaToSitemap';
import searchSitemap from './helpers/searchSitemap';

import type { SitemapEntry } from './types';
import type { TreeCanvasItem, TreeCanvasNodeState } from '@plitzi/plitzi-ui/TreeCanvas';
import type { Element, PageFolder } from '@plitzi/sdk-shared';

export type SitemapDiagramProps = {
  pages: Element[];
  pageFolders: PageFolder[];
  /** Each layout's name, by id — what a page's card says it renders inside. */
  layouts?: Record<string, string>;
  /** The page open in the canvas. */
  currentPageId?: string;
  /** A new page — inside a folder when one is given — or a new folder. */
  onAddNode?: (nodeType: 'page' | 'folder', folderId?: string) => void;
  /** A page or folder dropped into a folder, or onto the top level (`null`). */
  onMove?: (entry: SitemapEntry, folderId: string | null) => void;
  onRemove?: (entry: SitemapEntry) => void;
  /** A page opened in the canvas, from its card, a double click or Enter. */
  onOpen?: (pageId: string) => void;
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

const flatten = (entries: SitemapEntry[]): SitemapEntry[] =>
  entries.flatMap(entry => [entry, ...(entry.type === 'folder' ? flatten(entry.children) : [])]);

const NO_FOLDS: string[] = [];

/**
 * The site as a map: every folder over what it holds, laid out on its own. From here a page is found, opened, moved by
 * dropping it onto a folder, or removed; a folder folds away what it holds.
 */
const SitemapDiagram = ({
  pages,
  pageFolders,
  layouts,
  currentPageId,
  onAddNode,
  onMove,
  onRemove,
  onOpen,
  onClose
}: SitemapDiagramProps) => {
  const { addToast } = useToast();
  const { showDialog } = useModal();
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [folded = NO_FOLDS, setFolded] = useStorage<string[]>('builder-state.sitemap.folded', NO_FOLDS);
  const entries = useMemo(() => schemaToSitemap(pages, pageFolders, layouts), [layouts, pages, pageFolders]);
  const byId = useMemo(() => new Map(flatten(entries).map(entry => [entry.id, entry])), [entries]);
  const items = useMemo(() => toItems(entries), [entries]);
  const search = useMemo(() => searchSitemap(entries, query), [entries, query]);
  // A folder holding a match is shown open, folded or not — a search that finds a page behind a fold has found nothing.
  const collapsedIds = useMemo(
    () => (search.ancestors.size > 0 ? folded.filter(id => !search.ancestors.has(id)) : folded),
    [folded, search.ancestors]
  );
  const revealId = search.matches.at(matchIndex);
  const counts = useMemo(() => {
    const all = [...byId.values()];

    return {
      pages: all.filter(entry => entry.type === 'page').length,
      folders: all.filter(e => e.type === 'folder').length
    };
  }, [byId]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setMatchIndex(0);
  }, []);

  const handleNextMatch = useCallback(
    (backwards: boolean) => {
      const total = search.matches.length;
      if (total === 0) {
        return;
      }

      const next = (matchIndex + (backwards ? total - 1 : 1)) % total;
      setMatchIndex(next);
      setSelectedId(search.matches[next]);
    },
    [matchIndex, search.matches]
  );

  const handleToggle = useCallback(
    (id: string) =>
      setFolded(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id])),
    [setFolded]
  );

  const handleAddPage = useCallback(() => onAddNode?.('page'), [onAddNode]);
  const handleAddFolder = useCallback(() => onAddNode?.('folder'), [onAddNode]);
  const handleAddPageIn = useCallback((folderId: string) => onAddNode?.('page', folderId), [onAddNode]);

  const handleActivate = useCallback(
    (id: string) => {
      const entry = byId.get(id);
      if (entry?.type === 'page') {
        onOpen?.(id);
      } else if (entry) {
        handleToggle(id);
      }
    },
    [byId, handleToggle, onOpen]
  );

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
      const entry = byId.get(id);
      if (entry) {
        void handleRemove(entry);
      }
    },
    [byId, handleRemove]
  );

  const handleMove = useCallback(
    (id: string, parentId: string | null) => {
      const entry = byId.get(id);
      if (entry) {
        onMove?.(entry, parentId);
      }
    },
    [byId, onMove]
  );

  const renderNode = useCallback(
    (item: TreeCanvasItem<SitemapEntry>, state: TreeCanvasNodeState) => (
      <SitemapNode
        entry={item.data}
        selected={state.selected}
        dropTarget={state.dropTarget}
        current={item.id === currentPageId}
        onOpen={onOpen}
        onAddPage={onAddNode ? handleAddPageIn : undefined}
        onRemove={handleRemove}
      />
    ),
    [currentPageId, handleAddPageIn, handleRemove, onAddNode, onOpen]
  );

  return (
    <TreeCanvas<SitemapEntry>
      className="h-full w-full"
      ariaLabel="Sitemap"
      items={items}
      nodeWidth={232}
      nodeHeight={108}
      gapX={40}
      gapY={64}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onActivate={handleActivate}
      onMove={onMove ? handleMove : undefined}
      onDelete={onRemove ? handleDelete : undefined}
      collapsedIds={collapsedIds}
      onToggleCollapsed={handleToggle}
      highlightIds={query.trim() ? search.visible : undefined}
      revealId={revealId}
      renderNode={renderNode}
      rootDropLabel="Move to the top level"
    >
      <SitemapToolbar
        pageCount={counts.pages}
        folderCount={counts.folders}
        query={query}
        matchCount={search.matches.length}
        matchIndex={matchIndex}
        onQueryChange={handleQueryChange}
        onNextMatch={handleNextMatch}
        onAddPage={handleAddPage}
        onAddFolder={handleAddFolder}
        onClose={onClose}
      />
      <SitemapLegend />
    </TreeCanvas>
  );
};

export default SitemapDiagram;
