/* eslint-disable quotes */
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import type { Element } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type PageActionsProps = {
  id?: string;
  active?: boolean;
  zoom?: boolean;
  type: string;
  defaultPage?: boolean;
  onZoom?: (e: MouseEvent) => void;
};

const ItemActions = ({
  id = '',
  type = '',
  active = false,
  zoom = false,
  defaultPage = false,
  onZoom
}: PageActionsProps) => {
  const [element] = useBuilderStore(`schema.flat.${id}`);
  const { eventBridge } = use(EventBridgeContext);
  const { navigate, currentPageId } = use(NavigationContext);
  const { showDialog } = useModal();
  const { addToast } = useToast();

  const handleClickSetHome = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!(element as Element | undefined)) {
        return;
      }

      if (defaultPage) {
        addToast('This page is already home page', {
          appeareance: 'info',
          autoDismiss: true,
          placement: 'top-right'
        });

        return;
      }

      const response = await showDialog(
        <Modal.Header>
          <h4>Set Home Page</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-4 py-2">
            <h4>Do you want to mark this page as home page ?</h4>
          </div>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        id
      );

      if (response) {
        void eventBridge.emit('main', 'schemaHomePage', id);
      }
    },
    [element, id, defaultPage, showDialog, addToast, eventBridge]
  );

  const handleClickRemove = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!(element as Element | undefined)) {
        return;
      }

      if (defaultPage) {
        addToast("You can't delete the home page", {
          appeareance: 'warning',
          autoDismiss: true,
          placement: 'top-right'
        });

        return;
      }

      const response = await showDialog(
        <Modal.Header>
          <h4>{`Remove ${type === 'page' ? 'Page' : 'Layout'}`}</h4>
        </Modal.Header>,
        <Modal.Body>
          <h4>Do you want to remove this item ?</h4>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        id
      );

      if (!response) {
        return;
      }

      if (type === 'page') {
        void eventBridge.emit('main', 'schemaRemovePage', id);
        navigate('/');
      } else if (type === 'layoutContainer') {
        void eventBridge.emit('builder', 'builderSetBaseContext', currentPageId);
        void eventBridge.emit('main', 'schemaRemoveElement', id);
      }
    },
    [element, id, defaultPage, showDialog, type, addToast, eventBridge, navigate, currentPageId]
  );

  return (
    <Flex gap={2} items="center" className={clsx({ 'hidden group-hover:flex': !active && !zoom && !defaultPage })}>
      {!defaultPage && type === 'page' && (
        <Icon
          size="xs"
          cursor="pointer"
          intent="primary"
          icon="fas fa-home"
          title="Set Home Page"
          onClick={handleClickSetHome}
        />
      )}
      <Flex gap={2} items="center" className={clsx({ 'hidden group-hover:flex': !active && !zoom })}>
        {zoom && (
          <Icon
            size="xs"
            icon="fa-solid fa-magnifying-glass-minus"
            cursor="pointer"
            title="Zoom Out"
            onClick={onZoom}
          />
        )}
        {!zoom && (
          <Icon size="xs" icon="fa-solid fa-magnifying-glass-plus" cursor="pointer" title="Zoom In" onClick={onZoom} />
        )}
        <Icon
          size="xs"
          icon="fas fa-trash-alt"
          intent="danger"
          cursor="pointer"
          title="Remove Page"
          onClick={handleClickRemove}
        />
      </Flex>
    </Flex>
  );
};

export default ItemActions;
