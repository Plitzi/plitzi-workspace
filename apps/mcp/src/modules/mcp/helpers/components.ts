import { componentNamed, instancesOf } from '@plitzi/sdk-schema/helpers/components';

import type { Space } from './space';
import type { AIComponentSummary } from '../types';
import type { Schema, SpaceComponent } from '@plitzi/sdk-shared';

/** A component by the name it is placed by, unless a page or a layout answers to it first. */
export const findComponentByRef = (schema: Schema, ref: string): SpaceComponent | undefined =>
  Object.hasOwn(schema.flat, ref) ? undefined : componentNamed(schema, ref);

/**
 * The space as an op addressed to a component sees it: the component's tree as the only one, its root as the one root.
 *
 * `flat` IS the component's own object, so whatever the op writes lands in the component. Every other tree is out of
 * sight — a component is closed, nothing in it may name them — but not out of mind: `document` is the whole space,
 * which is what a new name has to be free of.
 */
export const componentView = (space: Space, component: SpaceComponent): Space => ({
  ...space,
  schema: { ...space.schema, flat: component.flat, pages: [component.rootId], components: {} },
  document: space.document ?? space.schema
});

export const componentSummariesToAI = (schema: Schema): AIComponentSummary[] =>
  Object.values(schema.components).map(component => ({
    ref: component.id,
    label: component.label ?? component.id,
    props: component.props ?? {},
    slots: component.slots ?? [],
    rootRef: component.rootId,
    instances: instancesOf(schema, component.id).length,
    elementCount: Object.keys(component.flat).length
  }));
