import { describe, expect, it } from 'vitest';

import { elementFromWire } from './wire';

describe('elementFromWire', () => {
  it('drops what GraphQL answered `null` for — in the definition, and inside a motion it named every field of', () => {
    expect(
      elementFromWire({
        id: 'hero',
        attributes: {},
        definition: {
          rootId: 'home',
          type: 'container',
          label: 'Hero',
          styleSelectors: { base: '' },
          anchor: null,
          motion: { enter: 'fade-up', on: 'view', duration: null, delay: 120, stagger: null, loop: null }
        }
      }).definition
    ).toEqual({
      rootId: 'home',
      type: 'container',
      label: 'Hero',
      styleSelectors: { base: '' },
      motion: { enter: 'fade-up', on: 'view', delay: 120 }
    });
  });
});
