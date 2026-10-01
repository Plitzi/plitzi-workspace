import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Input from '@plitzi/plitzi-ui/Input';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use, useMemo, useState } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { useBuilderStore, useBuilderStoreGetter, useBuilderStoreSetter } from '@plitzi/sdk-shared/store';

import ComponentForm from './components/ComponentForm';
import ComponentItem from './components/ComponentItem';
import { componentLabel, emptyComponent, instanceCounts } from './helpers';

import type { SpaceComponentDeclaration } from '@plitzi/sdk-shared';

/**
 * The space's components: what each is called and how many places render it. A component is placed by dragging it
 * onto a page, and edited by opening it in the canvas, where its tree is edited like a page's.
 */
const Components = () => {
  const [filter, setFilter] = useState('');
  const { showModal } = useModal();
  const { eventBridge } = use(EventBridgeContext);
  const { componentDefinitions } = use(ComponentContext);
  const [[components, flat, pageFolders, componentOpen]] = useBuilderStore([
    'schema.components',
    'schema.flat',
    'schema.pageFolders',
    'componentOpen'
  ]);
  const getSchema = useBuilderStoreGetter('schema');
  const setBuilderStore = useBuilderStoreSetter();

  const listed = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const counts = instanceCounts({ flat, components });

    return Object.values(components)
      .filter(component => !query || componentLabel(component).toLowerCase().includes(query))
      .map(component => ({ component, instances: counts[component.id] ?? 0 }));
  }, [components, flat, filter]);

  const handleAdd = useCallback(async () => {
    const declaration = await showModal<SpaceComponentDeclaration>(
      <Modal.Header>
        <h4>New Component</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <ComponentForm pageFolders={pageFolders} onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (declaration) {
      const component = emptyComponent(
        declaration.label ?? 'Component',
        getSchema(),
        componentDefinitions.current.container
      );
      void eventBridge.emit('main', 'schemaAddComponent', { ...component, ...declaration, slots: [] });
      setBuilderStore('componentOpen', component.id);
    }
  }, [showModal, pageFolders, getSchema, componentDefinitions, eventBridge, setBuilderStore]);

  return (
    <Flex direction="column" gap={2} className="w-full p-2">
      <Flex gap={2} direction="column">
        <Button size="sm" onClick={handleAdd} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          New Component
        </Button>
        <Input placeholder="Search" value={filter} onChange={setFilter} size="sm">
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
      </Flex>
      <div className="mt-2 h-px bg-gray-200 dark:bg-zinc-700" />
      <Flex direction="column">
        {listed.map(({ component, instances }) => (
          <ComponentItem
            key={component.id}
            component={component}
            instances={instances}
            open={component.id === componentOpen}
            pageFolders={pageFolders}
          />
        ))}
        {listed.length === 0 && (
          <span className="text-sm text-gray-500 dark:text-zinc-400">
            No components yet. Make one with New Component, or from an element: right click → Save as component.
          </span>
        )}
      </Flex>
    </Flex>
  );
};

export default Components;
