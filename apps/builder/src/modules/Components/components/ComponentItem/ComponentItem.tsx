import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { useBuilderStoreSetter } from '@plitzi/sdk-shared/store';
import { REUSE } from '@pmodules/Builder/helpers/reuse';
import useDragElement from '@pmodules/Elements/hooks/useDragElement';

import { componentLabel } from '../../helpers';
import { slotChoicesOf } from '../../slotChoices';
import ComponentForm, { COMPONENT_MODAL } from '../ComponentForm';

import type { PageFolder, SpaceComponent, SpaceComponentDeclaration } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ComponentItemProps = {
  component: SpaceComponent;
  /** How many places in the space render it. */
  instances: number;
  /** Whether it is the one open in the canvas. */
  open: boolean;
  pageFolders: PageFolder[];
};

/** One component of the space: dragged onto a page to place it, opened to edit its tree, renamed, removed. */
const ComponentItem = ({ component, instances, open, pageFolders }: ComponentItemProps) => {
  const { showModal, showDialog } = useModal();
  const { addToast } = useToast();
  const { eventBridge } = use(EventBridgeContext);
  const { componentDefinitions } = use(ComponentContext);
  const setBuilderStore = useBuilderStoreSetter();
  const label = componentLabel(component);
  const { onDragStart } = useDragElement({
    type: 'reference',
    attributes: { referenceType: 'component', referenceId: component.id },
    label
  });

  const handleOpen = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      setBuilderStore('componentOpen', component.id);
    },
    [component.id, setBuilderStore]
  );

  const handleEdit = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      const declaration = await showModal<SpaceComponentDeclaration>(
        <Modal.Header>
          <h4>Component — {label}</h4>
        </Modal.Header>,
        ({ onSubmit, onClose }) => (
          <Modal.Body>
            <ComponentForm
              declaration={component}
              slotChoices={slotChoicesOf(component.flat, component.rootId, componentDefinitions.current)}
              pageFolders={pageFolders}
              onSubmit={onSubmit}
              onClose={onClose}
            />
          </Modal.Body>
        ),
        undefined,
        COMPONENT_MODAL
      );

      if (declaration) {
        void eventBridge.emit('main', 'schemaUpdateComponent', component.id, declaration);
      }
    },
    [showModal, label, component, componentDefinitions, pageFolders, eventBridge]
  );

  const handleRemove = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      if (instances > 0) {
        addToast(
          <span>
            <b>{label}</b> is placed in {instances} {instances === 1 ? 'place' : 'places'}. Detach or remove those
            instances first.
          </span>,
          { appeareance: 'warning', autoDismiss: true, placement: 'top-right' }
        );

        return;
      }

      const confirmed = await showDialog(
        <Modal.Header>
          <h4>Remove Component</h4>
        </Modal.Header>,
        <Modal.Body className="p-4">
          <h4>Remove {label}? Nothing places it.</h4>
        </Modal.Body>
      );

      if (confirmed) {
        if (open) {
          setBuilderStore('componentOpen', undefined);
        }

        void eventBridge.emit('main', 'schemaRemoveComponent', component.id);
      }
    },
    [instances, addToast, label, showDialog, open, setBuilderStore, eventBridge, component.id]
  );

  return (
    <Flex
      className={clsx('group my-1 rounded px-1 first:mt-0', {
        'cursor-grabbing': !open,
        'bg-primary-50 dark:bg-zinc-800': open
      })}
      gap={2}
      items="center"
      draggable={!open}
      onDragStart={onDragStart}
    >
      <Icon icon={REUSE.component.icon} intent="primaryActive" />
      <div className="flex grow basis-0 flex-col overflow-hidden">
        <div className="group-hover:text-primary-text truncate font-bold">{label}</div>
        <div className="truncate text-xs text-gray-500 dark:text-zinc-400">
          {instances} {instances === 1 ? 'instance' : 'instances'}
        </div>
      </div>
      <div className="hidden gap-1 group-hover:flex">
        <Icon icon="fa-solid fa-pen-ruler" onClick={handleOpen} title="Edit in canvas" size="sm" cursor="pointer" />
        <Icon icon="fas fa-pen" onClick={handleEdit} title="Props and slots" size="sm" cursor="pointer" />
        <Icon
          icon="fas fa-trash-alt"
          onClick={handleRemove}
          title="Remove"
          size="sm"
          cursor="pointer"
          intent="danger"
        />
      </div>
    </Flex>
  );
};

export default ComponentItem;
