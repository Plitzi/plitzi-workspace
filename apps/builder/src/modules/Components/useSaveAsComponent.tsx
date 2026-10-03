import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { useBuilderStore, useBuilderStoreGetter } from '@plitzi/sdk-shared/store';
import { REUSE } from '@pmodules/Builder/helpers/reuse';
import { makeIdMinter } from '@pmodules/Elements/ElementHelper';

import ComponentForm from './components/ComponentForm';
import { componentIdFor } from './helpers';
import { slotChoicesOf } from './slotChoices';

import type { Element, SpaceComponentDeclaration } from '@plitzi/sdk-shared';

/**
 * Makes a component of an element on the canvas: the element and everything inside it become the component's tree,
 * and an instance of it takes the element's place, so the page renders what it did. Returns whether it was made.
 */
const useSaveAsComponent = () => {
  const { showModal } = useModal();
  const { eventBridge } = use(EventBridgeContext);
  const { componentDefinitions } = use(ComponentContext);
  const [[pageFolders, setSelected]] = useBuilderStore(['schema.pageFolders', 'setSelected']);
  const [getSchema, getFlat] = useBuilderStoreGetter(['schema', 'schema.flat']);

  return useCallback(
    async (element: Element): Promise<boolean> => {
      const declaration = await showModal<SpaceComponentDeclaration>(
        <Modal.Header>
          <h4>Save as Component</h4>
        </Modal.Header>,
        ({ onSubmit, onClose }) => (
          <Modal.Body>
            <p className="mb-3 text-sm text-gray-600 first-letter:uppercase dark:text-zinc-400">
              {REUSE.component.hint}.
            </p>
            <ComponentForm
              declaration={{ label: element.definition.label }}
              slotChoices={slotChoicesOf(getFlat(), element.id, componentDefinitions.current)}
              pageFolders={pageFolders}
              onSubmit={onSubmit}
              onClose={onClose}
            />
          </Modal.Body>
        )
      );

      if (!declaration) {
        return false;
      }

      const schema = getSchema();
      const id = componentIdFor(declaration.label ?? element.definition.label, schema.components);
      const instanceId = makeIdMinter(schema)('reference');
      void eventBridge.emit(
        'main',
        'schemaAddComponent',
        { ...declaration, id, rootId: '', flat: {} },
        { elementId: element.id, instanceId }
      );
      setSelected(instanceId, undefined, true);

      return true;
    },
    [showModal, getFlat, componentDefinitions, pageFolders, getSchema, eventBridge, setSelected]
  );
};

export default useSaveAsComponent;
