// Packages
import { useCallback, use } from 'react';
import { ComponentContext } from '@plitzi/plitzi-sdk';
import set from 'lodash/set';
import sneakCase from 'lodash/snakeCase';
import { produce } from 'immer';
import pick from 'lodash/pick';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeModuleTypes, EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Relatives
import { generateID } from '../../../helpers/utils';

/**
 * @param {{
 *   attributes?: { [key: string]: any };
 *   type?: string;
 *   variables?: object[];
 *   onParentRefresh?: (identifier: string, segment: object) => void;
 * }} props
 * @returns {{ onDragStart: (e: any) => void }}
 */
const useDragElement = (props = {}) => {
  const { attributes, type, variables = [] } = props;
  const { componentDefinitions } = use(ComponentContext);
  const { eventBridge } = use(EventBridgeContext);

  const onDragStart = useCallback(
    e => {
      let element = pick(componentDefinitions[type], ['definition', 'attributes']);
      if (!element) {
        return;
      }

      if (attributes) {
        element = produce(element, draft => {
          switch (type) {
            case 'image':
              if (attributes?.src) {
                set(draft, 'attributes.src', attributes?.src);
              }

              break;
            case 'video':
              if (attributes?.src) {
                set(draft, 'attributes.src', attributes?.src);
              }

              break;

            case 'reference': {
              if (attributes?.referenceType && attributes?.referenceId) {
                set(draft, 'attributes.referenceType', attributes?.referenceType);
                set(draft, 'attributes.referenceId', attributes?.referenceId);
              }

              break;
            }

            default:
          }
        });
      }

      e.stopPropagation();
      eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_SELECTED, null);
      e.dataTransfer.setDragImage(e.currentTarget, -5, -5);
      e.dataTransfer.setData(
        `add##${sneakCase(element.definition.type)}`,
        JSON.stringify({
          id: generateID(),
          element,
          variables
        })
      );
    },
    [componentDefinitions, type, attributes, eventBridge]
  );

  return { onDragStart };
};

export default useDragElement;
