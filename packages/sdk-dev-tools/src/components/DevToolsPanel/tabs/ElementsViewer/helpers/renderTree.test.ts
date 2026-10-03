import { describe, expect, it } from 'vitest';

import { filterRows, renderTree } from './renderTree';

import type { Element, Schema } from '@plitzi/sdk-shared';

const element = (
  id: string,
  type: string,
  rootId: string,
  items: string[] = [],
  attributes: Record<string, unknown> = {},
  hidden = false
): Element => ({
  id,
  attributes,
  definition: {
    type,
    label: id,
    rootId,
    items,
    styleSelectors: { base: '' },
    ...(hidden ? { initialState: { visibility: false } } : {})
  }
});

const flat: Schema['flat'] = {
  shell: element('shell', 'layoutContainer', 'shell', ['shell-nav', 'shell-slot']),
  'shell-nav': element('shell-nav', 'container', 'shell'),
  'shell-slot': element('shell-slot', 'container', 'shell'),
  home: element('home', 'page', 'home', ['hero', 'card'], {
    name: 'Home',
    layout: 'shell',
    layoutContainer: 'shell-slot'
  }),
  hero: element('hero', 'container', 'home', ['hero-title'], {}, true),
  'hero-title': element('hero-title', 'heading', 'home'),
  card: element('card', 'reference', 'home', [], { referenceType: 'component', referenceId: 'product-card' })
};

const components: Schema['components'] = {
  'product-card': {
    id: 'product-card',
    label: 'Product card',
    rootId: 'product-card-root',
    flat: {
      'product-card-root': element('product-card-root', 'container', 'product-card-root', ['product-card-title']),
      'product-card-title': element('product-card-title', 'heading', 'product-card-root')
    }
  }
};

describe('renderTree', () => {
  const sections = renderTree({ flat, components }, 'home');

  it('lists the layouts around the page first, then the page, then each component placed', () => {
    expect(sections.map(({ kind, title }) => `${kind}:${title}`)).toEqual([
      'layout:shell',
      'page:Home',
      'component:Product card'
    ]);
  });

  it('writes each tree in reading order, at its depth, saying what starts hidden and what is an instance', () => {
    expect(sections[1].rows).toEqual([
      { id: 'home', label: 'home', type: 'page', depth: 0, hidden: false },
      { id: 'hero', label: 'hero', type: 'container', depth: 1, hidden: true },
      { id: 'hero-title', label: 'hero-title', type: 'heading', depth: 2, hidden: false },
      { id: 'card', label: 'card', type: 'reference', depth: 1, hidden: false, instanceOf: 'product-card' }
    ]);
    expect(sections[2].rows.map(row => row.id)).toEqual(['product-card-root', 'product-card-title']);
  });

  it('knows no page it does not hold', () => {
    expect(renderTree({ flat, components }, 'nowhere')).toEqual([]);
  });
});

describe('filterRows', () => {
  const rows = renderTree({ flat, components }, 'home')[1].rows;

  it('keeps a match and the rows above it in its tree', () => {
    expect(filterRows(rows, 'title').map(row => row.id)).toEqual(['home', 'hero', 'hero-title']);
    expect(filterRows(rows, 'REFERENCE').map(row => row.id)).toEqual(['home', 'card']);
  });

  it('keeps everything for an empty search', () => {
    expect(filterRows(rows, '  ')).toHaveLength(rows.length);
  });
});
