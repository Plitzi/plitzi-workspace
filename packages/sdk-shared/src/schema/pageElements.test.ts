import { describe, expect, it } from 'vitest';

import { pageElementTypes } from './pageElements';

import type { Element, Schema } from '../types';

const element = (
  id: string,
  type: string,
  items: string[] = [],
  attributes: Record<string, unknown> = {}
): Element => ({
  id,
  attributes,
  definition: { type, label: id, rootId: 'root', items, styleSelectors: { base: '' } }
});

const schema = {
  flat: {
    shell: element('shell', 'layoutContainer', ['nav', 'slot']),
    nav: element('nav', 'navMenu'),
    slot: element('slot', 'container'),
    home: element('home', 'page', ['hero', 'card', 'copy', 'loop'], { layout: 'shell', layoutContainer: 'slot' }),
    hero: element('hero', 'custom', [], { renderType: 'heroCanvas' }),
    card: element('card', 'reference', [], { referenceType: 'component', referenceId: 'Card' }),
    copy: element('copy', 'reference', [], { referenceType: 'element', referenceId: 'chart' }),
    loop: element('loop', 'container', ['loop']),
    other: element('other', 'page', ['chart']),
    chart: element('chart', 'chartPlugin')
  },
  components: {
    Card: {
      id: 'Card',
      rootId: 'cardRoot',
      flat: {
        cardRoot: element('cardRoot', 'container', ['cardMap', 'cardSelf']),
        cardMap: element('cardMap', 'mapPlugin'),
        cardSelf: element('cardSelf', 'reference', [], { referenceType: 'component', referenceId: 'Card' })
      }
    }
  }
} as unknown as Schema;

describe('pageElementTypes', () => {
  const types = pageElementTypes(schema, 'home');

  it('counts the page, the shell around it, and what a custom element renders', () => {
    expect(types).toContain('page');
    expect(types).toContain('navMenu');
    expect(types).toContain('heroCanvas');
  });

  it('follows a component instance into its tree, and an element reference to what it copies', () => {
    expect(types).toContain('mapPlugin');
    expect(types).toContain('chartPlugin');
  });

  it('stays on its page, and ends on a tree that names itself', () => {
    expect(pageElementTypes(schema, 'other')).toEqual(new Set(['page', 'chartPlugin']));
  });

  it('answers nothing for a page it cannot find', () => {
    expect(pageElementTypes(schema, 'ghost').size).toBe(0);
  });
});
