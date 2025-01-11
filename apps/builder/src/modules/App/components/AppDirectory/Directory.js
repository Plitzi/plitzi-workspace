// Packages
import React, { useCallback, use, useMemo, useState } from 'react';
import upperFirst from 'lodash/upperFirst';
import get from 'lodash/get';
import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Text from '@plitzi/plitzi-ui/Text';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeTypes, EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Alias
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';
import PageFolderForm from '@pmodules/App/models/PageFolderForm';

// Relatives
import Page from './Page';

const pageFoldersDefault = [];

/**
 * @param {{
 *   id?: string;
 *   name?: string;
 *   slug?: string;
 *   parentId?: string;
 *   pageFolders?: any[];
 *   isRootFolder?: boolean;
 *   currentPageId?: string;
 *   nestedLevel?: number;
 * }} props
 * @returns {React.ReactElement}
 */
const Directory = props => {
  const {
    id = '',
    name = '',
    slug = '',
    parentId,
    isRootFolder = false,
    currentPageId,
    nestedLevel = 0,
    pageFolders = pageFoldersDefault
  } = props;
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { eventBridge } = use(EventBridgeContext);
  const { pageDefinitions, pages } = use(SchemaMainContext);
  const pagesMemo = useMemo(
    () =>
      pages
        .map(pageId => get(pageDefinitions, pageId))
        .filter(page => get(page, 'attributes.folder') === id || (!get(page, 'attributes.folder') && !id))
        .sort((pageA, pageB) => {
          const { default: defaultA, name: nameA } = get(pageA, 'attributes', {});
          const { default: defaultB, name: nameB } = get(pageB, 'attributes', {});
          if (defaultA || (nameA < nameB && !defaultB)) {
            return -1;
          }

          return 1;
        })
        .map(page => page.id),
    [pages, pageDefinitions, parentId]
  );
  const [collapsed, setCollapsed] = useState(!(pagesMemo && pagesMemo.length > 0));

  const handleClickSettings = useCallback(
    async e => {
      e.stopPropagation();
      e.preventDefault();
      const response = await showModal(
        <Modal.Header>
          <h4>Update Page Folder</h4>
        </Modal.Header>,
        <Modal.Body>
          <PageFolderForm pageFolders={pageFolders} name={name} slug={slug} parentId={parentId} />
        </Modal.Body>,
        null,
        { placement: 'center', renderFooter: false }
      );

      if (response.result) {
        const { data } = response;
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_UPDATE_PAGE_FOLDER, { id, ...data });
      }
    },
    [pageFolders, id, name, slug, parentId, showModal, eventBridge]
  );

  const handleClickRemoveFolder = useCallback(
    async e => {
      e.stopPropagation();
      e.preventDefault();
      if (!pageFolders.find(pageFolder => pageFolder.id === id)) {
        return;
      }

      const hasPages = pages.some(pageId => get(pageDefinitions, `${pageId}.attributes.folder`) === id);
      const hasPageFolders = pages.some(pageFolder => get(pageFolder, 'parentId') === id);
      if (hasPages || hasPageFolders) {
        addToast("You can't remove this folder with pages or folders", {
          appeareance: 'warning',
          autoDismiss: true,
          placement: 'top-right'
        });

        return;
      }

      const response = await showModal(
        <Modal.Header>
          <h4>Remove Page Folder</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-4 py-2">
            <h4>Do you want to remove this item ?</h4>
          </div>
        </Modal.Body>,
        null,
        { placement: 'center', renderFooter: true }
      );

      if (response.result) {
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_REMOVE_PAGE_FOLDER, id);
      }
    },
    [id, pageFolders, pages, addToast, eventBridge]
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
    [id, pageFolders, parentId]
  );

  const handleCollapse = useCallback(isCollapsed => setCollapsed(isCollapsed), []);

  return (
    <ContainerCollapsable collapsed={!(pagesMemo && pagesMemo.length > 0)} onChange={handleCollapse} gap={2}>
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
              intent="error"
              title="Remove Folder"
              onClick={handleClickRemoveFolder}
            />
          </Flex>
        )}
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content gap={2}>
        {pagesMemo &&
          pagesMemo.length > 0 &&
          pagesMemo.map(pageId => (
            <Page key={pageId} id={pageId} active={pageId === currentPageId} nestedLevel={nestedLevel + 1} />
          ))}
        {directories &&
          directories.length > 0 &&
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
