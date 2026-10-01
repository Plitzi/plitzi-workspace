import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use, useMemo } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { componentNamed } from '@plitzi/sdk-schema/helpers/components';
import { useBuilderStore, useBuilderStoreSetter } from '@plitzi/sdk-shared/store';

import SlotRow from './SlotRow';
import { componentLabel } from '../../helpers';

import type { Element } from '@plitzi/sdk-shared';

export type InstanceToolsProps = {
  instanceId: string;
  componentId: string;
};

/**
 * What only the builder can do with an instance, beside the settings of the element itself: open the component it
 * places, put each of its children in a slot, and detach it — a copy of the component that is then this page's own.
 */
const InstanceTools = ({ instanceId, componentId }: InstanceToolsProps) => {
  const { eventBridge } = use(EventBridgeContext);
  const { showDialog } = useModal();
  const setBuilderStore = useBuilderStoreSetter();
  const [[components, flat]] = useBuilderStore(['schema.components', 'schema.flat']);
  const component = componentNamed({ components }, componentId);
  const instance = Object.hasOwn(flat, instanceId) ? flat[instanceId] : undefined;

  const children = useMemo(
    () => (instance?.definition.items ?? []).flatMap<Element>(id => (Object.hasOwn(flat, id) ? [flat[id]] : [])),
    [instance?.definition.items, flat]
  );
  const slots = useMemo(
    () =>
      (component?.slots ?? []).map(slot => ({
        value: slot,
        label: Object.hasOwn(component?.flat ?? {}, slot) ? (component?.flat[slot].definition.label ?? slot) : slot
      })),
    [component]
  );

  const handleOpen = useCallback(() => setBuilderStore('componentOpen', componentId), [componentId, setBuilderStore]);

  const handleDetach = useCallback(async () => {
    const confirmed = await showDialog(
      <Modal.Header>
        <h4>Detach Instance</h4>
      </Modal.Header>,
      <Modal.Body className="p-4">
        <h4>
          Replace this instance with a copy of what it renders? The copy is this page’s own: editing the component will
          not change it any more.
        </h4>
      </Modal.Body>
    );

    if (confirmed) {
      void eventBridge.emit('main', 'schemaDetachInstance', instanceId);
    }
  }, [showDialog, eventBridge, instanceId]);

  if (!component) {
    return null;
  }

  return (
    <Flex direction="column" gap={2} className="border-t border-gray-200 py-3 dark:border-zinc-700">
      <span className="text-sm">
        Instance of <b>{componentLabel(component)}</b>
      </span>
      <Flex gap={2}>
        <Button size="xs" onClick={handleOpen} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-pen-ruler" />
          Edit component
        </Button>
        <Button size="xs" onClick={handleDetach} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-link-slash" />
          Detach
        </Button>
      </Flex>
      {children.length > 0 && slots.length > 0 && (
        <Flex direction="column" gap={1}>
          <span className="text-sm font-semibold">Slots</span>
          {children.map(child => (
            <SlotRow key={child.id} child={child} slots={slots} fallback={component.slots?.[0]} />
          ))}
        </Flex>
      )}
    </Flex>
  );
};

export default InstanceTools;
