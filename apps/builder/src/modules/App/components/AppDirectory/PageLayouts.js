// Packages
import React, { use, useMemo } from 'react';
import get from 'lodash/get';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Relatives
import PageLayout from './PageLayout';
import LayoutsHeader from './LayoutsHeader';

/**
 * @param {{}} props
 * @returns {React.ReactElement}
 */
const PageLayouts = () => {
  const {
    schema: { flat }
  } = use(SchemaContext);
  const { currentPageId } = use(NavigationContext);
  const { eventBridge } = use(EventBridgeContext);
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
      eventBridge.emit('builder', EventBridgeTypes.BUILDER_SET_BASE_CONTEXT, currentPageId);
      eventBridge.emit('main', EventBridgeTypes.SCHEMA_REMOVE_ELEMENT, layoutId);
    }
  };

  const handleClickLayout = layoutId => () =>
    eventBridge.emit('builder', EventBridgeTypes.BUILDER_SET_BASE_CONTEXT, layoutId);

  const layouts = useMemo(
    () => Object.values(flat).filter(element => get(element, 'definition.type', '') === 'layoutContainer'),
    [flat]
  );

  return (
    <div className="flex flex-col">
      <LayoutsHeader />
      <div className="flex w-full flex-col items-center overflow-auto">
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

export default PageLayouts;
