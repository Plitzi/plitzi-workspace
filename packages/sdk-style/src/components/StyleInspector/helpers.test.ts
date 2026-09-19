import { describe, expect, it } from 'vitest';

import { ancestorClasses, ancestorConditions, ancestorOptions, ancestorRemovals, unusedAncestors } from './helpers';

import type { Element, Schema, Style, StyleItem } from '@plitzi/sdk-shared';

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

describe('ancestorConditions', () => {
  it('lists every condition, inside first and the states in cascade order', () => {
    expect(
      ancestorConditions({
        card: {
          default: { color: 'blue' },
          states: { active: { color: 'red' }, hover: { color: 'green' }, focus: {} }
        },
        sidebar: { variants: { collapsed: { default: {}, states: { hover: { display: 'block' } } } } }
      })
    ).toEqual([
      { ancestor: 'card', label: 'inside' },
      { ancestor: 'card', state: 'hover', label: 'hover' },
      { ancestor: 'card', state: 'active', label: 'active' },
      { ancestor: 'sidebar', variant: 'collapsed', state: 'hover', label: 'collapsed:hover' }
    ]);
  });
});

describe('unusedAncestors', () => {
  const item = (ancestors: string[], type: StyleItem['type'] = 'class', name = 'icon'): StyleItem => ({
    name,
    type,
    ...(type === 'element' ? { componentType: name } : {}),
    attributes: {
      base: {
        default: {},
        ancestors: Object.fromEntries(ancestors.map(ancestor => [ancestor, { default: { color: 'red' } }]))
      }
    },
    cache: ''
  });

  it('keeps the ancestors some wearer sits inside, and returns the rest', () => {
    expect([...unusedAncestors(flat, item(['card', 'layout', 'sidebar']))]).toEqual(['sidebar']);
  });

  it('reads an element selector by the elements of its type', () => {
    expect([...unusedAncestors(flat, item(['card', 'toolbar'], 'element', 'container'))]).toEqual(['toolbar']);
  });

  it('says every ancestor is unused when nothing wears the selector', () => {
    expect([...unusedAncestors(flat, item(['card'], 'class', 'nobody'))]).toEqual(['card']);
  });
});

describe('ancestorRemovals', () => {
  it('finds each breakpoint and slot that has rules under the ancestors being purged', () => {
    const withRules = (slots: string[]): StyleItem => ({
      name: 'icon',
      type: 'class',
      attributes: Object.fromEntries(
        slots.map(slot => [slot, { default: {}, ancestors: { card: { default: { color: 'red' } }, row: {} } }])
      ),
      cache: ''
    });
    const platform: Style['platform'] = {
      desktop: { icon: withRules(['base', 'label']) },
      tablet: {},
      mobile: { icon: withRules(['base']) }
    };

    expect(ancestorRemovals(platform, 'icon', new Set(['card']))).toEqual([
      { displayMode: 'desktop', styleSelector: 'base', styleAncestor: 'card' },
      { displayMode: 'desktop', styleSelector: 'label', styleAncestor: 'card' },
      { displayMode: 'mobile', styleSelector: 'base', styleAncestor: 'card' }
    ]);
  });
});
