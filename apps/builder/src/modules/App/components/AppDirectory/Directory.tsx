/* eslint-disable quotes */
import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import Text from '@plitzi/plitzi-ui/Text';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, use, useMemo, useState } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import PageFolderForm from '@pmodules/App/models/PageFolderForm';

import DirectoryItem from './DirectoryItem';

import type { PageFolder, Element } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type DirectoryProps = {
  id?: string;
  name?: string;
  slug?: string;
  parentId?: string;
  pageFolders?: PageFolder[];
  elements?: Element[];
  isRootFolder?: boolean;
  currentPageId?: string;
  nestedLevel?: number;
};

const Directory = ({
  id = '',
  name = '',
  slug = '',
  parentId,
  isRootFolder = false,
  currentPageId,
  nestedLevel = 0,
  pageFolders,
  elements
}: DirectoryProps) => {
  const { showModal, showDialog } = useModal();
  const { addToast } = useToast();
  const { eventBridge } = use(EventBridgeContext);
  const items = useMemo(
    () => (elements ?? []).filter(({ attributes }) => attributes.folder === id || (!attributes.folder && !id)),
    [elements, id]
  );
  const directories = useMemo(
    () =>
      (pageFolders ?? [])
        .filter(folder => folder.parentId === id || (!folder.parentId && !id))
        .sort((folderA, folderB) => (folderA.name > folderB.name ? 1 : -1)),
    [id, pageFolders]
  );
  const [collapsed, setCollapsed] = useState(!(items.length > 0 || directories.length > 0));

  const handleClickSettings = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const response = await showModal(
        <Modal.Header>
          <h4>Update Page Folder</h4>
        </Modal.Header>,
        ({ onSubmit, onClose }) => (
          <Modal.Body>
            <PageFolderForm
              onClose={onClose}
              onSubmit={onSubmit}
              pageFolders={pageFolders}
              name={name}
              slug={slug}
              parentId={parentId}
            />
          </Modal.Body>
        )
      );

      if (response) {
        void eventBridge.emit('main', 'schemaUpdatePageFolder', { id, ...response });
      }
    },
    [pageFolders, id, name, slug, parentId, showModal, eventBridge]
  );

  const titleMemo = useMemo(
    () => (
      <Flex justify="between" grow style={{ paddingLeft: nestedLevel * 12 }}>
        <Flex items="center" gap={2}>
          {collapsed && <Icon size="xs" intent="custom" icon="fa-solid fa-folder" />}
          {!collapsed && <Icon size="xs" intent="custom" icon="fa-regular fa-folder-open" />}
          <Text size="sm" weight="bold" className="capitalize">
            {name}
          </Text>
        </Flex>
      </Flex>
    ),
    [name, nestedLevel, collapsed]
  );

  const handleClickRemoveFolder = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!pageFolders?.find(pageFolder => pageFolder.id === id)) {
        return;
      }

      if (items.length > 0 || directories.length > 0) {
        addToast("You can't remove this folder with elements or folders", {
          appeareance: 'warning',
          autoDismiss: true,
          placement: 'top-right'
        });

        return;
      }

      const response = await showDialog(
        <Modal.Header>
          <h4>Remove Page Folder</h4>
        </Modal.Header>,
        <Modal.Body>
          <h4>Do you want to remove this item ?</h4>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        id
      );

      if (response) {
        void eventBridge.emit('main', 'schemaRemovePageFolder', id);
      }
    },
    [pageFolders, items.length, directories, showDialog, id, addToast, eventBridge]
  );

  const handleCollapse = useCallback((isCollapsed: boolean) => setCollapsed(isCollapsed), []);

  return (
    <ContainerCollapsable collapsed={!(items.length > 0 || directories.length > 0)} onChange={handleCollapse} gap={1}>
      <ContainerCollapsable.Header
        placement="right"
        iconCollapsed={<Icon size="sm" icon="fa-solid fa-angle-left" />}
        iconExpanded={<Icon size="sm" icon="fa-solid fa-angle-down" />}
        className="py-0"
        title={titleMemo}
      >
        {!isRootFolder && (
          <Flex gap={2} items="center">
            <Icon size="xs" icon="fa-solid fa-gear" cursor="pointer" title="Settings" onClick={handleClickSettings} />
            <Icon
              size="xs"
              icon="fas fa-trash-alt"
              cursor="pointer"
              intent="danger"
              title="Remove Folder"
              onClick={handleClickRemoveFolder}
            />
          </Flex>
        )}
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content gap={1}>
        {items.map(item => (
          <DirectoryItem
            key={item.id}
            element={item}
            active={item.id === currentPageId}
            nestedLevel={nestedLevel + 1}
          />
        ))}
        {directories.length > 0 &&
          directories.map(directory => (
            <Directory
              key={directory.id}
              {...directory}
              slug={directory.slug}
              currentPageId={currentPageId}
              parentId={id}
              pageFolders={pageFolders}
              elements={elements}
              nestedLevel={nestedLevel + 1}
            />
          ))}
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default Directory;
