import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use, useMemo } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { useBuilderStore, useBuilderStoreGetter, useBuilderStoreSetter } from '@plitzi/sdk-shared/store';

import ComponentForm from './components/ComponentForm';
import ComponentItem from './components/ComponentItem';
import { componentLabel, emptyComponent, instanceCounts } from './helpers';

import type { SpaceComponentDeclaration } from '@plitzi/sdk-shared';

export type ComponentsProps = {
  /** What the catalog is searched for: the elements above and these alike. */
  filter: string;
};

/**
 * The space's components, at the foot of the element catalog: placed the way an element is, by dragging it onto a
 * page — with what each is called and how many places render it. Edited by opening it in the canvas, where its tree is
 * edited like a page's.
 */
const Components = ({ filter }: ComponentsProps) => {
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

  const emptyMessage = filter.trim()
    ? 'No component matches the search.'
    : 'No components yet. Make one with New, or from an element: right click → Save as component.';

  return (
    <Flex direction="column" gap={1}>
      <Flex items="center" justify="between" gap={2}>
        <span className="px-1 text-[10px] font-semibold tracking-wide text-gray-400 uppercase dark:text-zinc-500">
          Components
        </span>
        <Button size="xs" title="New component" onClick={handleAdd} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          New
        </Button>
      </Flex>
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
        {listed.length === 0 && <span className="px-1 text-xs text-gray-500 dark:text-zinc-400">{emptyMessage}</span>}
      </Flex>
    </Flex>
  );
};

export default Components;
