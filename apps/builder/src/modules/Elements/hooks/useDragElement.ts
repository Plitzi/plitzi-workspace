import { get, set, pick } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import type { ComponentDefinition, Element, Template } from '@plitzi/sdk-shared';
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
      let element = pick(componentDefinitions.current[type], ['definition', 'attributes']);
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

      // No id: the document being dropped into mints the name, since only it knows what is already taken.
      e.dataTransfer.setData(`add##${type}`, JSON.stringify({ element, variables }));
    },
    [attributes, componentDefinitions, type, variables]
  );

  const onDragTemplate = useCallback(
    (e: DragEvent) => {
      if (!manifest) {
        return;
      }

      const flat = get(manifest, 'schema.flat', {}) as Record<string, Element>;
      const variables = get(manifest, 'schema.variables', []);
      const templateBaseElementId = get(manifest, 'definition.baseElementId', '');
      const baseElement = flat[templateBaseElementId] as Element | undefined;
      if (!baseElement) {
        return;
      }

      // Carried as authored, not re-cloned: a manifest is a throwaway copy already, and cloning would rename every
      // element in it — `hero` arriving as `hero-2` in a space that has no `hero`. The document it lands in renames
      // only what actually collides there.
      const elements = Object.fromEntries(FlatMap.childTree(flat, templateBaseElementId).map(id => [id, flat[id]]));

      e.dataTransfer.setData(
        'add##plitzi-template',
        JSON.stringify({ elements, baseElement, style: get(manifest, 'style', {}), variables })
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
