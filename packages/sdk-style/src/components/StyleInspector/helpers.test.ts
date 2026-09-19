import { describe, expect, it } from 'vitest';

import { ancestorClasses, ancestorOptions } from './helpers';

import type { Element, Schema } from '@plitzi/sdk-shared';

const node = (id: string, base: string, parentId?: string): Element => ({
  id,
  attributes: {},
  definition: { label: id, type: 'container', rootId: 'page', parentId, styleSelectors: { base } }
});

const flat: Schema['flat'] = {
  page: node('page', 'layout layout--wide'),
  card: node('card', 'card', 'page'),
  row: node('row', '', 'card'),
  icon: node('icon', 'icon', 'row')
};

describe('ancestorClasses', () => {
  it('lists the classes around an element, closest first, each once', () => {
    expect(ancestorClasses({ ...flat, row: node('row', 'card', 'card') }, flat.icon)).toEqual([
      'card',
      'layout',
      'layout--wide'
    ]);
  });

  it('skips the element itself and ancestors with no class', () => {
    expect(ancestorClasses(flat, flat.icon)).toEqual(['card', 'layout', 'layout--wide']);
    expect(ancestorClasses(flat, flat.page)).toEqual([]);
    expect(ancestorClasses(flat, undefined)).toEqual([]);
  });
});

describe('ancestorOptions', () => {
  it('says which conditions an ancestor already has rules for', () => {
    const options = ancestorOptions(['card', 'layout'], {
      card: { default: { color: 'blue' }, states: { hover: { color: 'red' } } },
      sidebar: { variants: { collapsed: { default: { display: 'none' }, states: { hover: { display: 'block' } } } } }
    });

    expect(options).toEqual([
      { label: '.card — inside, hover', value: 'card' },
      { label: '.layout', value: 'layout' },
      { label: '.sidebar — collapsed, collapsed:hover', value: 'sidebar' }
    ]);
  });
});
