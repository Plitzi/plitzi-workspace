import { describe, expect, it } from 'vitest';

import { schemaFromWire, schemaToWire, validateSpaceEvent } from './spaceEvents';

import type { Schema, SchemaRaw } from '../types';

const schema = {
  definition: { name: 'Wire', permanentUrl: 'wire' },
  flat: {
    home: {
      id: 'home',
      attributes: { default: true },
      definition: { label: 'Home', type: 'page', rootId: 'home', items: [], styleSelectors: { base: '' } }
    }
  },
  variables: [],
  settings: { customCss: '' },
  pages: ['home'],
  pageFolders: []
} as unknown as Schema;

describe('schema on the live channel', () => {
  it('travels with `flat` as a list and comes back keyed by id', () => {
    const wire = schemaToWire(schema);

    expect(wire.flat).toEqual([schema.flat.home]);
    expect(schemaFromWire(wire)).toEqual(schema);
  });

  // GraphQL answers every field a query names: an element without a gate arrives with `flag: null`, and the builder's
  // tools read an absent gate as `undefined`. What the store gets back is the element as its document has it.
  it('leaves out what GraphQL answered `null` for, and keeps what the element has', () => {
    const wire: SchemaRaw = {
      ...schemaToWire(schema),
      flat: [
        {
          id: 'home',
          attributes: {},
          definition: {
            label: 'Home',
            type: 'page',
            rootId: 'home',
            styleSelectors: { base: '' },
            items: ['hero'],
            parentId: null,
            flag: null,
            runtime: null,
            loadStrategy: null,
            anchor: null,
            bindings: null,
            interactions: null,
            initialState: { visibility: false }
          }
        }
      ]
    };

    expect(schemaFromWire(wire).flat.home.definition).toStrictEqual({
      label: 'Home',
      type: 'page',
      rootId: 'home',
      styleSelectors: { base: '' },
      items: ['hero'],
      initialState: { visibility: false }
    });
  });

  // The keyed map a server holds is exactly what a SPACE_UPDATED payload must not carry.
  it('is what the SPACE_UPDATED contract accepts', () => {
    expect(validateSpaceEvent('SPACE_UPDATED', { schema: schemaToWire(schema) }).ok).toBe(true);
    expect(validateSpaceEvent('SPACE_UPDATED', { schema }).ok).toBe(false);
  });
});
