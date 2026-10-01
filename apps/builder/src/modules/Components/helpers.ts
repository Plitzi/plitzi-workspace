import { instancesOf } from '@plitzi/sdk-schema/helpers/components';
import { slugifyElementId, uniqueElementId } from '@plitzi/sdk-schema/helpers/elementId';
import { makeIdMinter } from '@pmodules/Elements/ElementHelper';

import type { ComponentDefinition, Schema, SpaceComponent } from '@plitzi/sdk-shared';

/** A name for a new component, from what the author called it and free among the space's components. */
export const componentIdFor = (label: string, components: Schema['components']): string =>
  uniqueElementId(slugifyElementId(label) || 'component', candidate => Object.hasOwn(components, candidate));

/**
 * A new component with nothing in it yet: the one container it is built in, made the way a drop makes one — from the
 * element's own declaration — and named free of every tree of the document.
 */
export const emptyComponent = (
  label: string,
  schema: Pick<Schema, 'flat' | 'components'>,
  container: ComponentDefinition
): SpaceComponent => {
  const rootId = makeIdMinter(schema)('container');
  const { parentId: _parentId, ...definition } = container.definition;

  return {
    id: componentIdFor(label, schema.components),
    label,
    rootId,
    flat: {
      [rootId]: {
        id: rootId,
        attributes: { ...container.attributes },
        definition: { ...definition, rootId, items: [] }
      }
    }
  };
};

/** What the builder shows a component as: the name the author gave it, else its id. */
export const componentLabel = (component: SpaceComponent): string => component.label ?? component.id;

/**
 * How many places render each component.
 *
 * Counted tree by tree. While a component is open, the builder reads `schema.flat` with its tree laid over the pages',
 * so an element is counted from that flat only when no component holds it — and from its component's tree otherwise.
 */
export const instanceCounts = (schema: Pick<Schema, 'flat' | 'components'>): Record<string, number> => {
  const owned = new Set(Object.values(schema.components).flatMap(component => Object.keys(component.flat)));
  const document = {
    flat: Object.fromEntries(Object.entries(schema.flat).filter(([id]) => !owned.has(id))),
    components: schema.components
  };

  return Object.fromEntries(Object.keys(schema.components).map(id => [id, instancesOf(document, id).length]));
};
