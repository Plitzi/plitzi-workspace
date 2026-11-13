import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { useCallback, use, useState } from 'react';

import { EventBridgeContext } from '@plitzi/sdk-event-bridge';
import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { useBuilderStoreSetter } from '@plitzi/sdk-shared/store';
import { REUSE } from '@pmodules/Builder/helpers/reuse';
import useDragElement from '@pmodules/Elements/hooks/useDragElement';

import { componentLabel } from '../../helpers';
import { slotChoicesOf } from '../../slotChoices';
import ComponentDetails from '../ComponentDetails';
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

/**
 * One component of the space: dragged onto a page to place it, unfolded to see it and where it is placed, opened to
 * edit its tree — marked while it is — renamed, removed.
 */
const ComponentItem = ({ component, instances, open, pageFolders }: ComponentItemProps) => {
  const { showModal, showDialog } = useModal();
  const { addToast } = useToast();
  const { eventBridge } = use(EventBridgeContext);
  const { componentDefinitions } = use(ComponentContext);
  const setBuilderStore = useBuilderStoreSetter();
  const [unfolded, setUnfolded] = useState(false);
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

  const handleToggle = useCallback(() => setUnfolded(value => !value), []);

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
          <h4>Remove component</h4>
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
    <div
      className={clsx('my-0.5 rounded first:mt-0', {
        'bg-primary-50 ring-primary-300 dark:bg-primary-400/15 dark:ring-primary-400/40 ring-1': open
      })}
    >
      <Flex
        className={clsx('group rounded px-1 py-0.5', {
          'cursor-grab hover:bg-gray-50 dark:hover:bg-zinc-800/60': !open
        })}
        gap={2}
        items="center"
        draggable={!open}
        aria-current={open ? 'true' : undefined}
        onDragStart={onDragStart}
      >
        <button
          type="button"
          className="flex w-3 shrink-0 cursor-pointer justify-center text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
          aria-expanded={unfolded}
          title={unfolded ? 'Hide the preview and where it is used' : 'Show a preview and where it is used'}
          onClick={handleToggle}
        >
          <i className={clsx('fa-solid text-[9px]', unfolded ? 'fa-chevron-down' : 'fa-chevron-right')} />
        </button>
        <Icon icon={REUSE.component.icon} intent="primaryActive" />
        <div className="flex grow basis-0 flex-col overflow-hidden">
          <div
            className={clsx('truncate font-bold', {
              'text-primary-700 dark:text-primary-200': open,
              'group-hover:text-primary-text': !open
            })}
          >
            {label}
          </div>
          <div className="flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-zinc-400">
            {open && (
              <span className="bg-primary-500 rounded-sm px-1 text-[10px] leading-4 font-semibold text-white">
                Editing
              </span>
            )}
            {instances} {instances === 1 ? 'instance' : 'instances'}
          </div>
        </div>
        <div className={clsx('gap-1', open ? 'flex' : 'hidden group-hover:flex')}>
          {!open && (
            <Icon icon="fa-solid fa-pen-ruler" onClick={handleOpen} title="Edit in canvas" size="sm" cursor="pointer" />
          )}
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
      {unfolded && <ComponentDetails component={component} />}
    </div>
  );
};

export default ComponentItem;
