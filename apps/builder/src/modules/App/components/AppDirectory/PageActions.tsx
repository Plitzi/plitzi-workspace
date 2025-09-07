/* eslint-disable quotes */
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import classNames from 'classnames';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

import type { Element } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type PageActionsProps = {
  id?: string;
  active?: boolean;
  zoom?: boolean;
  defaultPage?: boolean;
  onZoom?: (e: MouseEvent) => void;
};

const PageActions = ({ id = '', active = false, zoom = false, defaultPage = false, onZoom }: PageActionsProps) => {
  const {
    schema: { flat }
  } = use(SchemaContext);
  const { eventBridge } = use(EventBridgeContext);
  const { navigate } = use(NavigationContext);
  const { showDialog } = useModal();
  const { addToast } = useToast();

  const handleClickSetHome = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!(flat[id] as Element | undefined)) {
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
        undefined,
        id
      );

      if (response) {
        void eventBridge.emit('main', 'schemaHomePage', id);
      }
    },
    [flat, id, defaultPage, showDialog, addToast, eventBridge]
  );

  const handleClickRemovePage = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!(flat[id] as Element | undefined)) {
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
          <h4>Remove Page</h4>
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
        void eventBridge.emit('main', 'schemaRemovePage', id);
        navigate('/');
      }
    },
    [flat, id, defaultPage, showDialog, addToast, eventBridge, navigate]
  );

  return (
    <Flex
      gap={2}
      items="center"
      className={classNames({ 'hidden group-hover:flex': !active && !zoom && !defaultPage })}
    >
      {!defaultPage && (
        <Icon
          size="xs"
          cursor="pointer"
          intent="primary"
          icon="fas fa-home"
          title="Set Home Page"
          onClick={handleClickSetHome}
        />
      )}
      <Flex gap={2} items="center" className={classNames({ 'hidden group-hover:flex': !active && !zoom })}>
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
          onClick={handleClickRemovePage}
        />
      </Flex>
    </Flex>
  );
};

export default PageActions;
