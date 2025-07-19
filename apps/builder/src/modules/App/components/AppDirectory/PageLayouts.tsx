import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import get from 'lodash/get';
import { use, useMemo } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

import LayoutsHeader from './LayoutsHeader';
import PageLayout from './PageLayout';

import type { Element } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const PageLayouts = () => {
  const {
    schema: { flat }
  } = use(SchemaContext);
  const { currentPageId } = use(NavigationContext);
  const { eventBridge } = use(EventBridgeContext);
  const { showDialog } = useModal();

  const handleClickRemoveLayout = (layoutId: string) => async (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const layout = flat[layoutId];
    if (!(layout as Element | undefined)) {
      return;
    }

    const response = await showDialog(
      <Modal.Header>
        <h4>Remove Page Layout</h4>
      </Modal.Header>,
      <Modal.Body>
        <div className="px-4 py-2">
          <h4>Do you want to remove this item ?</h4>
        </div>
      </Modal.Body>
    );

    if (response) {
      void eventBridge.emit('builder', 'builderSetBaseContext', currentPageId);
      void eventBridge.emit('main', 'schemaRemoveElement', layoutId);
    }
  };

  const handleClickLayout = (layoutId: string) => () => eventBridge.emit('builder', 'builderSetBaseContext', layoutId);

  const layouts = useMemo(
    () => Object.values(flat).filter(element => get(element, 'definition.type', '') === 'layoutContainer'),
    [flat]
  );

  return (
    <div className="flex flex-col">
      <LayoutsHeader />
      <div className="flex w-full flex-col items-center overflow-auto">
        {layouts.map(layout => (
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
