import { get, set, omit, pick } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import { generateID } from '../../../helpers/utils';

import type { ComponentDefinition, Template } from '@plitzi/sdk-shared';
import type { DragEvent } from 'react';

export type UseDragElementProps = {
  attributes?: Record<string, unknown>;
  type: string;
  variables?: object[];
  manifest?: Template;
  onParentRefresh?: (identifier: string, segment: object) => void;
};

const useDragElement = ({ attributes, type, variables, manifest }: UseDragElementProps) => {
  const { componentDefinitions } = use(ComponentContext);
  const { eventBridge } = use(EventBridgeContext);

  const onDragElement = useCallback(
    (e: DragEvent) => {
      let element = pick(componentDefinitions[type], ['definition', 'attributes']);
      if (!(element as ComponentDefinition | undefined)) {
        return;
      }

      if (attributes) {
        element = produce(element, draft => {
          switch (type) {
            case 'image':
              if (attributes.src) {
                set(draft, 'attributes.src', attributes.src);
              }

              break;
            case 'video':
              if (attributes.src) {
                set(draft, 'attributes.src', attributes.src);
              }

              break;

            case 'reference': {
              if (attributes.referenceType && attributes.referenceId) {
                set(draft, 'attributes.referenceType', attributes.referenceType);
                set(draft, 'attributes.referenceId', attributes.referenceId);
              }

              break;
            }

            default:
          }
        });
      }

      e.dataTransfer.setData(
        `add##${element.definition.type}`,
        JSON.stringify({ id: generateID(), element, variables })
      );
    },
    [attributes, componentDefinitions, type, variables]
  );

  const onDragTemplate = useCallback(
    (e: DragEvent) => {
      if (!manifest) {
        return;
      }

      const flat = get(manifest, 'schema.flat', {});
      const variables = get(manifest, 'schema.variables', []);
      const templateBaseElementId = get(manifest, 'definition.baseElementId', '');
      const itemsToAdd = FlatMap.cloneElements(flat, templateBaseElementId);
      if (!itemsToAdd.item) {
        return;
      }

      e.dataTransfer.setData(
        'add##plitzi-template',
        JSON.stringify({
          elements: omit(itemsToAdd.acum, [itemsToAdd.item.id]),
          baseElement: itemsToAdd.item,
          style: get(manifest, 'style', {}),
          variables
        })
      );
    },
    [manifest]
  );

  const onDragStart = useCallback(
    (e: DragEvent) => {
      e.stopPropagation();
      void eventBridge.emit('builder', 'builderSetSelected', null);
      e.dataTransfer.setDragImage(e.currentTarget, -5, -5);

      if (type === 'template') {
        onDragTemplate(e);
      } else {
        onDragElement(e);
      }
    },
    [eventBridge, type, onDragTemplate, onDragElement]
  );

  return { onDragStart };
};

export default useDragElement;
