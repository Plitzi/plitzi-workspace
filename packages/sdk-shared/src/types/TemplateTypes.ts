import type { Element, Schema } from './SchemaTypes';
import type { Style } from './StyleTypes';

/**
 * A published template: a subtree, the style that dresses it, and the element a builder instantiates.
 *
 * The artefact someone hosts when they are not building a space — fetched by URL, shown in the Resources panel,
 * dragged onto a canvas — which is why it lives beside the schema and the style rather than with the builder's own
 * types: it is a document, produced and consumed by processes that never open a builder.
 */
export type Template = {
  id?: string;
  definition: {
    name: string;
    description: string;
    /** Root of what travels. Its subtree is the whole of `schema.flat`, and it answers to no parent. */
    baseElementId: Element['id'];
  };
  schema: Schema;
  style: Style;
};
