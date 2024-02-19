// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import get from 'lodash/get';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import Button from '@plitzi/plitzi-ui-components/Button';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import { ComponentContext } from '@plitzi/plitzi-sdk';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeModuleTypes, EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import { DROP_DIRECTION_CUSTOM } from '@plitzi/sdk-schema/FlatMap';

// Alias
import NavigationContext from '@pmodules/Navigation/NavigationContext';

// Relatives
import { generateID } from '../../../../helpers/utils';
import PageLayout from './PageLayout';

const PageLayouts = props => {
  const { className = '' } = props;
  const {
    schema: { flat }
  } = useContext(SchemaContext);
  const { componentDefinitions } = useContext(ComponentContext);
  const { currentPageId } = useContext(NavigationContext);
  const { eventBridge } = useContext(EventBridgeContext);
  const { showModal } = useModal();

  const handleClickRemoveLayout = layoutId => async e => {
    e.stopPropagation();
    e.preventDefault();
    const layout = flat[layoutId];
    if (!layout) {
      return;
    }

    const response = await showModal(
      <Modal.Header>
        <h4>Remove Page Layout</h4>
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
      eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_BASE_CONTEXT, currentPageId);
      eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_REMOVE_ELEMENT, layoutId);
    }
  };

  const handleClickAddLayout = useCallback(async () => {
    const { definition, attributes } = componentDefinitions.layoutContainer;
    const id = generateID();
    const element = { id, attributes, definition: { ...definition, rootId: id, parentId: null } };
    eventBridge.emit(
      EventBridgeModuleTypes.MAIN,
      EventBridgeTypes.SCHEMA_ADD_ELEMENT,
      '',
      element,
      DROP_DIRECTION_CUSTOM
    );
  }, [eventBridge, componentDefinitions]);

  const handleClickLayout = layoutId => () =>
    eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_BASE_CONTEXT, layoutId);

  const layouts = useMemo(
    () => Object.values(flat).filter(element => get(element, 'definition.type', '') === 'layoutContainer'),
    [flat]
  );

  return (
    <div className={classNames('flex flex-col', className)}>
      <Button intent="custom" size="custom" onClick={handleClickAddLayout} className="px-4 py-3 bg-gray-600 text-white">
        <i className="fa-solid fa-table-columns fa-2x mr-4" />
        Add New Layout
      </Button>
      <div className="flex flex-col items-center overflow-auto px-4 w-full">
        {layouts &&
          layouts.map(layout => (
            <PageLayout
              key={layout.id}
              id={layout.id}
              name={layout.definition.label}
              onSelect={handleClickLayout(layout.id)}
              onRemove={handleClickRemoveLayout(layout.id)}
            />
          ))}
      </div>
    </div>
  );
};

PageLayouts.propTypes = {
  className: PropTypes.string
};

export default PageLayouts;
