import { describe, expect, it } from 'vitest';

import { rootName, searchElements } from './searchElements';

import type { Element } from '@plitzi/sdk-shared';

const element = (id: string, type: string, parentId?: string, label?: string, name?: string): Element => ({
  id,
  attributes: name ? { name } : {},
  definition: { rootId: 'home', label: label ?? '', type, parentId, styleSelectors: { base: '' } }
});

const flat = (...elements: Element[]): Record<string, Element> =>
  elements.reduce<Record<string, Element>>((acum, item) => ({ ...acum, [item.id]: item }), {});

const space = flat(
  element('home', 'page', undefined, 'Home', 'Home'),
  element('hero', 'container', 'home'),
  element('cta-primary', 'button', 'hero', 'Get started'),
  element('pricing', 'page', undefined, 'Pricing', 'Pricing'),
  element('pricing-table', 'container', 'pricing'),
  element('cta-secondary', 'button', 'pricing-table', 'See plans')
);

describe('searchElements', () => {
  /** The tree can only ever show one page: without this an author with forty pages opens pages until one has it. */
  it('finds elements on pages other than the one being edited', () => {
    const ids = searchElements(space, 'cta').map(match => match.id);

    expect(ids).toContain('cta-primary');
    expect(ids).toContain('cta-secondary');
  });

  it('says which page each answer lives on', () => {
    const [match] = searchElements(space, 'cta-secondary');

    expect(match.rootId).toBe('pricing');
    expect(rootName(space, match.rootId)).toBe('Pricing');
  });

  /** What the tree has to open to reveal the match, outermost first. */
  it('returns the chain of parents down to the match', () => {
    const [match] = searchElements(space, 'cta-secondary');

    expect(match.ancestors).toEqual(['pricing', 'pricing-table']);
  });

  it('ranks an exact id over a prefix over a substring over a label', () => {
    const ranked = searchElements(
      flat(
        element('cta', 'button'),
        element('cta-primary', 'button'),
        element('main-cta', 'button'),
        element('button1', 'button', undefined, 'The cta')
      ),
      'cta'
    ).map(match => match.id);

    expect(ranked).toEqual(['cta', 'cta-primary', 'main-cta', 'button1']);
  });

  it('matches on the type too, and ranks it last', () => {
    const ranked = searchElements(flat(element('hero', 'container'), element('wrap', 'container')), 'container');

    expect(ranked.map(match => match.id)).toEqual(['hero', 'wrap']);
    expect(ranked.every(match => match.score === 20)).toBe(true);
  });

  /** The author is looking at that page already; a tie should not send them somewhere else. */
  it('puts the page in front of the author first', () => {
    const ranked = searchElements(space, 'cta', { currentRootId: 'pricing' }).map(match => match.id);

    expect(ranked[0]).toBe('cta-secondary');
  });

  it('shows a label only when it says something the id does not', () => {
    const [withLabel] = searchElements(space, 'cta-primary');
    const [sameAsId] = searchElements(flat(element('hero', 'container', undefined, 'hero')), 'hero');

    expect(withLabel.label).toBe('Get started');
    expect(sameAsId.label).toBeUndefined();
  });

  it('answers nothing for an empty query', () => {
    expect(searchElements(space, '   ')).toEqual([]);
  });

  it('stops at the limit rather than handing back a list nobody scrolls', () => {
    const many = flat(...Array.from({ length: 200 }, (_, index) => element(`btn${index}`, 'button')));

    expect(searchElements(many, 'btn', { limit: 10 })).toHaveLength(10);
  });

  /** Two people editing at once can briefly describe a cycle; walking it must not hang the panel. */
  it('survives a parent chain that loops', () => {
    const looped = flat(element('a', 'container', 'b'), element('b', 'container', 'a'));

    expect(() => searchElements(looped, 'a')).not.toThrow();
    expect(searchElements(looped, 'a')[0].ancestors).toEqual(['b']);
  });
});

describe('rootName', () => {
  it('prefers the page name, then the label, then the id', () => {
    expect(rootName(space, 'home')).toBe('Home');
    expect(rootName(flat(element('shell', 'layoutContainer', undefined, 'App shell')), 'shell')).toBe('App shell');
    expect(rootName(flat(element('bare', 'layoutContainer')), 'bare')).toBe('bare');
    expect(rootName(space, 'gone')).toBe('gone');
  });
});
