import { describe, expect, it } from 'vitest';

import { chainOf, isInRoot } from './elementChain';

import type { Element } from '@plitzi/sdk-shared';

const element = (id: string, parentId?: string): Element => ({
  id,
  attributes: {},
  definition: { rootId: 'home', label: '', type: 'container', parentId, styleSelectors: { base: '' } }
});

const flat = (...elements: Element[]): Record<string, Element> =>
  elements.reduce<Record<string, Element>>((acum, item) => ({ ...acum, [item.id]: item }), {});

const space = flat(
  element('home'),
  element('hero', 'home'),
  element('cta', 'hero'),
  element('shell'),
  element('nav', 'shell')
);

describe('chainOf', () => {
  it('returns the parents down to the element, outermost first', () => {
    expect(chainOf(space, 'cta')).toEqual({ rootId: 'home', ancestors: ['home', 'hero'] });
  });

  it('names a root as its own root', () => {
    expect(chainOf(space, 'home')).toEqual({ rootId: 'home', ancestors: [] });
  });

  /** Two people editing at once can briefly describe a cycle; walking it must not hang the panel. */
  it('survives a parent chain that loops', () => {
    const looped = flat(element('a', 'b'), element('b', 'a'));

    expect(chainOf(looped, 'a').ancestors).toEqual(['b']);
  });
});

describe('isInRoot', () => {
  it('answers whether an element lives in a page or layout', () => {
    expect(isInRoot(space, 'cta', 'home')).toBe(true);
    expect(isInRoot(space, 'home', 'home')).toBe(true);
    expect(isInRoot(space, 'nav', 'home')).toBe(false);
    expect(isInRoot(space, undefined, 'home')).toBe(false);
  });
});
