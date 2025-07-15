// Packages
import React, { useCallback, use } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import Icon from '@plitzi/plitzi-ui/Icon';
import Flex from '@plitzi/plitzi-ui/Flex';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

/**
 * @param {{
 *   id?: string;
 *   active?: boolean;
 *   zoom?: boolean;
 *   defaultPage?: boolean;
 *   onZoom?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const PageActions = props => {
  const { id = '', active = false, zoom = false, defaultPage = false, onZoom = noop } = props;
  const {
    schema: { flat }
  } = use(SchemaContext);
  const { eventBridge } = use(EventBridgeContext);
  const { navigate } = use(NavigationContext);
  const { showDialog } = useModal();
  const { addToast } = useToast();

  const handleClickSetHome = useCallback(
    async e => {
      e.stopPropagation();
      e.preventDefault();
      if (!flat[id]) {
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
        eventBridge.emit('main', EventBridgeTypes.SCHEMA_HOME_PAGE, id);
      }
    },
    [id, eventBridge, flat, defaultPage]
  );

  const handleClickRemovePage = useCallback(
    async e => {
      e.stopPropagation();
      e.preventDefault();
      if (!flat[id]) {
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
        eventBridge.emit('main', EventBridgeTypes.SCHEMA_REMOVE_PAGE, id);
        navigate('/');
      }
    },
    [id, eventBridge, active, defaultPage, flat]
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
