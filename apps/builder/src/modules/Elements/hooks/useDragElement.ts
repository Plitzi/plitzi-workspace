import { produce } from 'immer';
import pick from 'lodash/pick';
import set from 'lodash/set';
import sneakCase from 'lodash/snakeCase';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import { generateID } from '../../../helpers/utils';

import type { ComponentDefinition } from '@plitzi/sdk-shared';
import type { DragEvent } from 'react';

export type UseDragElementProps = {
  attributes?: Record<string, unknown>;
  type: string;
  variables?: object[];
  onParentRefresh?: (identifier: string, segment: object) => void;
};

const useDragElement = ({ attributes, type, variables }: UseDragElementProps) => {
  const { componentDefinitions } = use(ComponentContext);
  const { eventBridge } = use(EventBridgeContext);

  const onDragStart = useCallback(
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

      e.stopPropagation();
      void eventBridge?.emit('builder', EventBridgeTypes.BUILDER_SET_SELECTED, null);
      e.dataTransfer.setDragImage(e.currentTarget, -5, -5);
      e.dataTransfer.setData(
        `add##${sneakCase(element.definition.type)}`,
        JSON.stringify({ id: generateID(), element, variables })
      );
    },
    [componentDefinitions, type, attributes, eventBridge, variables]
  );

  return { onDragStart };
};

export default useDragElement;
