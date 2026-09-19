import { describe, expect, it } from 'vitest';

import { inStylesheetOrder, overriddenProperties, summarizeProperties } from './SelectorHelper';

import type { StyleBlock, StyleItem } from '@plitzi/sdk-shared';

const item = (name: string, base: StyleBlock): StyleItem => ({ name, type: 'class', cache: '', attributes: { base } });

describe('inStylesheetOrder', () => {
  it('orders an element’s classes as the stylesheet lists them, not as the element writes them', () => {
    const tags = [{ name: 'danger' }, { name: 'fill' }];

    expect(inStylesheetOrder(tags, ['fill', 'card', 'danger']).map(({ name }) => name)).toEqual(['fill', 'danger']);
  });

  it('keeps a class the stylesheet does not hold after the rest, in its own order', () => {
    const tags = [{ name: 'new-b' }, { name: 'card' }, { name: 'new-a' }];

    expect(inStylesheetOrder(tags, ['card']).map(({ name }) => name)).toEqual(['card', 'new-b', 'new-a']);
  });
});

describe('overriddenProperties', () => {
  const selectors = {
    fill: item('fill', { default: { color: 'blue', height: '100%' }, states: { hover: { color: 'navy' } } }),
    danger: item('danger', { default: { color: 'red' }, states: { hover: { color: 'maroon' } } }),
    wide: item('wide', { default: { width: '100%' } })
  };

  it('names what a later class sets again, per class and per state', () => {
    expect(overriddenProperties(['fill', 'danger', 'wide'], selectors)).toEqual({
      fill: [{ by: 'danger', properties: ['color', 'hover: color'] }]
    });
  });

  it('says nothing for the last class, or for classes that do not meet', () => {
    expect(overriddenProperties(['danger', 'fill'], selectors)).toEqual({
      danger: [{ by: 'fill', properties: ['color', 'hover: color'] }]
    });
    expect(overriddenProperties(['wide', 'fill'], selectors)).toEqual({});
  });

  it('ignores a class the stylesheet does not hold', () => {
    expect(overriddenProperties(['missing', 'fill'], selectors)).toEqual({});
  });
});

describe('summarizeProperties', () => {
  it('reads the four sides of a box property as that property', () => {
    expect(summarizeProperties(['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'color'])).toEqual([
      'padding',
      'color'
    ]);
  });

  it('keeps the side and its suffix together, and a partial set as written', () => {
    expect(
      summarizeProperties(['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'])
    ).toEqual(['border-width']);
    expect(summarizeProperties(['margin-top', 'margin-bottom'])).toEqual(['margin-top', 'margin-bottom']);
  });

  it('keeps a state’s sides apart from the base ones', () => {
    expect(
      summarizeProperties([
        'hover: padding-top',
        'hover: padding-right',
        'hover: padding-bottom',
        'hover: padding-left'
      ])
    ).toEqual(['hover: padding']);
  });
});
