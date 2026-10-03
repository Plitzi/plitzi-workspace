import type { Element, Schema, SchemaRaw, WireElement } from '../types';

// `flat` as a list is the wire shape of a schema — the live channel's and GraphQL's — and keyed by element id the
// runtime's. The keyed map an MCP write works with is not interchangeable with the list, and `SPACE_UPDATED`'s
// validator (`network/spaceEvents`) catches that swap. No dependency here, so a server reads a schema off GraphQL
// without loading that validator.

/** A schema as the channel carries it: `flat` as a list. What every publisher of a whole schema sends. */
export const schemaToWire = (schema: Schema): SchemaRaw => ({ ...schema, flat: Object.values(schema.flat) });

/** An element as the store holds it: what the wire sent `null` for is absent, as it is in the document. */
export const elementFromWire = ({ definition, ...element }: WireElement): Element => {
  const { parentId, items, bindings, interactions, initialState, runtime, loadStrategy, flag, anchor, ...required } =
    definition;

  return {
    ...element,
    definition: {
      ...required,
      ...(parentId === null || parentId === undefined ? {} : { parentId }),
      ...(items === null || items === undefined ? {} : { items }),
      ...(bindings === null || bindings === undefined ? {} : { bindings }),
      ...(interactions === null || interactions === undefined ? {} : { interactions }),
      ...(initialState === null || initialState === undefined ? {} : { initialState }),
      ...(runtime === null || runtime === undefined ? {} : { runtime }),
      ...(loadStrategy === null || loadStrategy === undefined ? {} : { loadStrategy }),
      ...(flag === null || flag === undefined ? {} : { flag }),
      ...(anchor === null || anchor === undefined ? {} : { anchor })
    }
  };
};

/**
 * A schema off the wire — the live channel or a GraphQL answer — keyed again by element id: what a receiver stores.
 * The one way in for both, so an element whose missing gate arrived as `null` never reaches code that reads absent as
 * `undefined`.
 */
export const schemaFromWire = (raw: SchemaRaw): Schema => ({
  ...raw,
  flat: Object.fromEntries(raw.flat.map(item => [item.id, elementFromWire(item)]))
});
