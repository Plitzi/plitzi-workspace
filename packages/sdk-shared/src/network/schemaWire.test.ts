import { describe, expect, it } from 'vitest';

import { schemaFromWire, schemaToWire, validateSpaceEvent } from './spaceEvents';

import type { Schema } from '../types';

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

  // The keyed map a server holds is exactly what a SPACE_UPDATED payload must not carry.
  it('is what the SPACE_UPDATED contract accepts', () => {
    expect(validateSpaceEvent('SPACE_UPDATED', { schema: schemaToWire(schema) }).ok).toBe(true);
    expect(validateSpaceEvent('SPACE_UPDATED', { schema }).ok).toBe(false);
  });
});
