import { set, pick } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { descendants } from '@plitzi/sdk-schema/helpers/elementTree';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import type { ComponentDefinition, Snippet } from '@plitzi/sdk-shared';
import type { DragEvent } from 'react';

export type UseDragElementProps = {
  attributes?: Record<string, unknown>;
  type: string;
  variables?: object[];
  manifest?: Snippet;
  /** What the dropped element is called in the builder's tree, instead of its type's default label. */
  label?: string;
};

const useDragElement = ({ attributes, type, variables, manifest, label }: UseDragElementProps) => {
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

      if (label) {
        element = produce(element, draft => {
          set(draft, 'definition.label', label);
        });
      }

      // No id: the document being dropped into mints the name, since only it knows what is already taken.
      e.dataTransfer.setData(`add##${type}`, JSON.stringify({ element, variables }));
    },
    [attributes, componentDefinitions, type, variables, label]
  );

  const onDragSnippet = useCallback(
    (e: DragEvent) => {
      if (!manifest) {
        return;
      }

      const { flat, variables } = manifest.schema;
      const snippetBaseElementId = manifest.definition.baseElementId;
      const baseElement = Object.hasOwn(flat, snippetBaseElementId) ? flat[snippetBaseElementId] : undefined;
      if (!baseElement) {
        return;
      }

      // Carried as authored, not re-cloned: a manifest is a throwaway copy already, and cloning would rename every
      // element in it — `hero` arriving as `hero-2` in a space that has no `hero`. The document it lands in renames
      // only what actually collides there.
      const elements = Object.fromEntries(descendants(flat, snippetBaseElementId).map(id => [id, flat[id]]));

      e.dataTransfer.setData(
        'add##plitzi-snippet',
        JSON.stringify({ elements, baseElement, style: manifest.style, variables })
      );
    },
    [manifest]
  );

  const onDragStart = useCallback(
    (e: DragEvent) => {
      e.stopPropagation();
      void eventBridge.emit('builder', 'builderSetSelected', null);
      e.dataTransfer.setDragImage(e.currentTarget, -5, -5);

      if (type === 'snippet') {
        onDragSnippet(e);
      } else {
        onDragElement(e);
      }
    },
    [eventBridge, type, onDragSnippet, onDragElement]
  );

  return { onDragStart };
};

export default useDragElement;
