import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { use, useCallback, useMemo } from 'react';

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
  const [[pageFolders, pageDefinitions]] = useBuilderStore(['schema.pageFolders', 'pageDefinitions']);
  const pages = useMemo(() => Object.values(pageDefinitions), [pageDefinitions]);
  const [, setSitemapOpen] = useSitemapOpen();

  const handleClose = useCallback(() => setSitemapOpen(false), [setSitemapOpen]);

  const handleAddNode = useCallback(
    async (nodeType: 'page' | 'folder') => {
      if (nodeType === 'page') {
        const response = await showModal(
          <Modal.Header>
            <h4>Add Page</h4>
          </Modal.Header>,
          ({ onSubmit, onClose }) => (
            <Modal.Body>
              <PageForm pageFolders={pageFolders} onSubmit={onSubmit} onClose={onClose} />
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
        onAddNode={handleAddNode}
        onMove={handleMove}
        onRemove={handleRemove}
        onClose={handleClose}
      />
    </div>
  );
};

export default ContainerSitemap;
