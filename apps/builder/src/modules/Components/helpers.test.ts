import { describe, expect, it } from 'vitest';

import { componentIdFor, instanceCounts } from './helpers';

import type { Element, Schema } from '@plitzi/sdk-shared';

const element = (id: string, type = 'container', attributes: Element['attributes'] = {}): Element => ({
  id,
  attributes,
  definition: { label: id, type, rootId: 'home', items: [], styleSelectors: { base: '' } }
});

const instance = (id: string, componentId: string) =>
  element(id, 'reference', { referenceType: 'component', referenceId: componentId });

const components: Schema['components'] = {
  card: { id: 'card', rootId: 'card-root', flat: { 'card-root': element('card-root') } },
  shelf: {
    id: 'shelf',
    rootId: 'shelf-root',
    flat: { 'shelf-root': element('shelf-root'), 'shelf-card': instance('shelf-card', 'card') }
  }
};

describe('Components helpers', () => {
  it('counts the places each component is rendered, in every tree', () => {
    const flat = { home: element('home'), lamp: instance('lamp', 'card'), shelf: instance('shelf', 'shelf') };

    expect(instanceCounts({ flat, components })).toEqual({ card: 2, shelf: 1 });
  });

  /** While a component is open, its tree is laid over the pages' flat: what it holds is counted once, from its own. */
  it('counts an open component’s elements once', () => {
    const flat = { home: element('home'), lamp: instance('lamp', 'card'), ...components.shelf.flat };

    expect(instanceCounts({ flat, components })).toEqual({ card: 2, shelf: 0 });
  });

  it('names a new component free of the others', () => {
    expect(componentIdFor('card', components)).toBe('card-2');
    expect(componentIdFor('shelf', components)).toBe('shelf-2');
  });
});
