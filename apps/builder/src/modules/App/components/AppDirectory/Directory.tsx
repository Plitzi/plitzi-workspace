/* eslint-disable quotes */
import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import Text from '@plitzi/plitzi-ui/Text';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import get from 'lodash/get';
import upperFirst from 'lodash/upperFirst';
import { useCallback, use, useMemo, useState } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';
import PageFolderForm from '@pmodules/App/models/PageFolderForm';

import Page from './Page';

import type { PageFolder } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const pageFoldersDefault = [];

export type DirectoryProps = {
  id?: string;
  name?: string;
  slug?: string;
  parentId?: string;
  pageFolders?: PageFolder[];
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
  pageFolders = pageFoldersDefault
}: DirectoryProps) => {
  const { showModal, showDialog } = useModal();
  const { addToast } = useToast();
  const { eventBridge } = use(EventBridgeContext);
  const { pageDefinitions, pages } = use(SchemaMainContext);
  const pagesMemo = useMemo(
    () =>
      pages
        .map(pageId => get(pageDefinitions, pageId))
        .filter(
          page => get(page, 'attributes.folder', '') === id || (!(get(page, 'attributes.folder', '') as string) && !id)
        )
        .sort((pageA, pageB) => {
          const { default: defaultA, name: nameA } = get(pageA, 'attributes', {}) as { default: boolean; name: string };
          const { default: defaultB, name: nameB } = get(pageB, 'attributes', {}) as { default: boolean; name: string };
          if (defaultA || (nameA < nameB && !defaultB)) {
            return -1;
          }

          return 1;
        })
        .map(page => page.id),
    [pages, pageDefinitions, id]
  );
  const [collapsed, setCollapsed] = useState(!(pagesMemo.length > 0));

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
        void eventBridge.emit('main', EventBridgeTypes.SCHEMA_UPDATE_PAGE_FOLDER, { id, ...response });
      }
    },
    [pageFolders, id, name, slug, parentId, showModal, eventBridge]
  );

  const handleClickRemoveFolder = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!pageFolders.find(pageFolder => pageFolder.id === id)) {
        return;
      }

      const hasPages = pages.some(pageId => get(pageDefinitions, `${pageId}.attributes.folder`, '') === id);
      const hasPageFolders = pages.some(pageFolder => get(pageFolder, 'parentId', '') === id);
      if (hasPages || hasPageFolders) {
        addToast("You can't remove this folder with pages or folders", {
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
          <div className="px-4 py-2">
            <h4>Do you want to remove this item ?</h4>
          </div>
        </Modal.Body>,
        undefined,
        undefined,
        id
      );

      if (response) {
        void eventBridge.emit('main', EventBridgeTypes.SCHEMA_REMOVE_PAGE_FOLDER, id);
      }
    },
    [pageFolders, pages, showDialog, id, pageDefinitions, addToast, eventBridge]
  );

  const titleMemo = useMemo(
    () => (
      <Flex justify="between" grow style={{ paddingLeft: nestedLevel * 16 }}>
        <Flex items="center" gap={2}>
          {collapsed && <Icon size="xs" intent="custom" icon="fa-solid fa-folder" />}
          {!collapsed && <Icon size="xs" intent="custom" icon="fa-regular fa-folder-open" />}
          <Text size="sm" weight="bold">
            {upperFirst(name)}
          </Text>
        </Flex>
      </Flex>
    ),
    [name, nestedLevel, collapsed]
  );

  const directories = useMemo(
    () =>
      pageFolders
        .filter(folder => folder.parentId === id || (!folder.parentId && !id))
        .sort((folderA, folderB) => (folderA.name > folderB.name ? 1 : -1)),
    [id, pageFolders]
  );

  const handleCollapse = useCallback((isCollapsed: boolean) => setCollapsed(isCollapsed), []);

  return (
    <ContainerCollapsable collapsed={!(pagesMemo.length > 0)} onChange={handleCollapse} gap={2}>
      <ContainerCollapsable.Header
        placement="right"
        iconCollapsed={<Icon size="sm" icon="fa-solid fa-angle-left" />}
        iconExpanded={<Icon size="sm" icon="fa-solid fa-angle-down" />}
        className="!p-0"
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
      <ContainerCollapsable.Content gap={2}>
        {pagesMemo.length > 0 &&
          pagesMemo.map((pageId: string) => (
            <Page key={pageId} id={pageId} active={pageId === currentPageId} nestedLevel={nestedLevel + 1} />
          ))}
        {directories.length > 0 &&
          directories.map(directory => (
            <Directory
              key={directory.id}
              {...directory}
              slug={directory.slug}
              parentId={id}
              pageFolders={pageFolders}
              currentPageId={currentPageId}
              nestedLevel={nestedLevel + 1}
            />
          ))}
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default Directory;
