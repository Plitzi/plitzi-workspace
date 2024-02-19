// Packages
import React, { useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeTypes, EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import SchemaContext from '@repo/schema-shared/SchemaContext';

// Alias
import NavigationContext from '@pmodules/Navigation/NavigationContext';

const PageActions = props => {
  const { className = '', id = '', active = false, zoom = false, defaultPage = false, onZoom = noop } = props;
  const {
    schema: { flat }
  } = useContext(SchemaContext);
  const { eventBridge } = useContext(EventBridgeContext);
  const { navigate } = useContext(NavigationContext);
  const { showModal } = useModal();
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

      const response = await showModal(
        <Modal.Header>
          <h4>Set Home Page</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-4 py-2">
            <h4>Do you want to mark this page as home page ?</h4>
          </div>
        </Modal.Body>,
        null,
        { placement: 'center', renderFooter: true }
      );

      if (response.result) {
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_HOME_PAGE, id);
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

      const response = await showModal(
        <Modal.Header>
          <h4>Remove Page</h4>
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
        eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_REMOVE_PAGE, id);
        navigate('/');
      }
    },
    [id, eventBridge, active, defaultPage, flat]
  );

  return (
    <div
      className={classNames(
        'flex gap-3 text-sm ml-2',
        {
          'group-hover:flex hidden': !active && !zoom && !defaultPage
        },
        className
      )}
    >
      <i
        className={classNames('fas fa-home', { 'text-blue-300': defaultPage })}
        onClick={handleClickSetHome}
        title="Set Home Page"
      />
      <div className={classNames('flex gap-3 items-center', { 'group-hover:flex hidden': !active && !zoom })}>
        {zoom && <i className="fa-solid fa-magnifying-glass-minus cursor-pointer" title="Zoom Out" onClick={onZoom} />}
        {!zoom && <i className="fa-solid fa-magnifying-glass-plus cursor-pointer" title="Zoom In" onClick={onZoom} />}
        <i
          className="fas fa-trash-alt text-red-500 cursor-pointer"
          title="Remove Page"
          onClick={handleClickRemovePage}
        />
      </div>
    </div>
  );
};

PageActions.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  active: PropTypes.bool,
  zoom: PropTypes.bool,
  defaultPage: PropTypes.bool,
  onZoom: PropTypes.func
};

export default PageActions;
