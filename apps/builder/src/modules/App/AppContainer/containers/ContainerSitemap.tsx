import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { use, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import SitemapDiagram from '@pmodules/App/components/SitemapDiagram';
import PageFolderForm from '@pmodules/App/models/PageFolderForm';
import PageForm from '@pmodules/App/models/PageForm';

import useSitemapOpen from '../../hooks/useSitemapOpen';

import type { SitemapEntry } from '@pmodules/App/components/SitemapDiagram';

const ContainerSitemap = () => {
  const { showModal } = useModal();
  const { eventBridge } = use(EventBridgeContext);
  const [[pageFolders, pageDefinitions, flat, currentPageId]] = useBuilderStore([
    'schema.pageFolders',
    'pageDefinitions',
    'schema.flat',
    'navigation.currentPageId'
  ]);
  const pages = useMemo(() => Object.values(pageDefinitions), [pageDefinitions]);
  const layouts = useMemo(
    () =>
      Object.fromEntries(
        Object.values(flat)
          .filter(element => element.definition.type === 'layoutContainer')
          .map(layout => [layout.id, layout.definition.label || layout.id])
      ),
    [flat]
  );
  const [, setSitemapOpen] = useSitemapOpen();
  const navigate = useNavigate();

  const handleClose = useCallback(() => setSitemapOpen(false), [setSitemapOpen]);

  // A page is a route in this editor: opening one is going to it, and the canvas comes back to show it.
  const handleOpen = useCallback(
    (pageId: string) => {
      void navigate(`/${pageId}`);
      setSitemapOpen(false);
    },
    [navigate, setSitemapOpen]
  );

  const handleAddNode = useCallback(
    async (nodeType: 'page' | 'folder', folderId = '') => {
      if (nodeType === 'page') {
        const response = await showModal(
          <Modal.Header>
            <h4>Add Page</h4>
          </Modal.Header>,
          ({ onSubmit, onClose }) => (
            <Modal.Body>
              <PageForm pageFolder={folderId} pageFolders={pageFolders} onSubmit={onSubmit} onClose={onClose} />
            </Modal.Body>
          )
        );

        if (response) {
          void eventBridge.emit('main', 'schemaAddPage', response);
        }
      } else {
        const response = await showModal(
          <Modal.Header>
            <h4>Add Page Folder</h4>
          </Modal.Header>,
          ({ onSubmit, onClose }) => (
            <Modal.Body>
              <PageFolderForm pageFolders={pageFolders} onSubmit={onSubmit} onClose={onClose} />
            </Modal.Body>
          )
        );

        if (response) {
          void eventBridge.emit('main', 'schemaAddPageFolder', response);
        }
      }
    },
    [eventBridge, pageFolders, showModal]
  );

  // A page lives in a folder by its `folder` attribute, a folder in another by its `parentId`; the top level is ''.
  const handleMove = useCallback(
    (entry: SitemapEntry, folderId: string | null) => {
      const into = folderId ?? '';
      if (entry.type === 'page') {
        const page = Object.hasOwn(pageDefinitions, entry.id) ? pageDefinitions[entry.id] : undefined;
        if (page) {
          void eventBridge.emit('main', 'schemaUpdateElement', {
            ...page,
            attributes: { ...page.attributes, folder: into }
          });
        }

        return;
      }

      const folder = pageFolders.find(candidate => candidate.id === entry.id);
      if (folder) {
        void eventBridge.emit('main', 'schemaUpdatePageFolder', { ...folder, parentId: into });
      }
    },
    [eventBridge, pageDefinitions, pageFolders]
  );

  const handleRemove = useCallback(
    (entry: SitemapEntry) => {
      if (entry.type === 'page') {
        void eventBridge.emit('main', 'schemaRemovePage', entry.id);
      } else {
        void eventBridge.emit('main', 'schemaRemovePageFolder', entry.id);
      }
    },
    [eventBridge]
  );

  return (
    <div className="flex min-h-0 grow basis-0 flex-col">
      <SitemapDiagram
        pages={pages}
        pageFolders={pageFolders}
        layouts={layouts}
        currentPageId={currentPageId}
        onOpen={handleOpen}
        onAddNode={handleAddNode}
        onMove={handleMove}
        onRemove={handleRemove}
        onClose={handleClose}
      />
    </div>
  );
};

export default ContainerSitemap;
