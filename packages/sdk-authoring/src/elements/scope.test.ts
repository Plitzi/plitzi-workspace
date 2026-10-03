import { describe, expect, it } from 'vitest';

import { authorSpace, button, container, heading, list, onClick, scope, scrollBy, text } from '../index';

import type { ElementSpec } from '../schema';

/** A block written by a helper that runs once per section. */
const spotlight = (section: string): ElementSpec =>
  scope(section, ref =>
    container({
      id: 'panel',
      children: [
        heading({ id: 'title', from: 'state.title' }),
        list({ id: 'slides', items: ['a', 'b'], row: r => text({ from: r.item }) }),
        button({ id: 'next', content: 'Next', flows: [[onClick(), scrollBy(ref('slides'), { x: '80%' })]] })
      ]
    })
  );

describe('scope', () => {
  it('prefixes every id given inside it, and names them in full for whatever refers to one', () => {
    const block = spotlight('promos');

    expect(block.id).toBe('promos-panel');
    expect(block.children?.map(child => child.id)).toEqual(['promos-title', 'promos-slides', 'promos-next']);
    expect(block.children?.[1].children?.[0].from).toBe('promos-slides.item');
    expect(block.children?.[2].flows?.[0][1]).toMatchObject({ action: 'scrollBy', on: 'promos-slides' });
  });

  it('lets one helper write the same block twice without a name taken twice', () => {
    expect(() =>
      authorSpace({
        name: 'Twice',
        permanentUrl: 'twice',
        pages: [{ id: 'home', name: 'Home', slug: '', body: [spotlight('deals'), spotlight('news')] }]
      })
    ).not.toThrow();
  });

  it('nests, and ends with the build it holds even when that throws', () => {
    expect(scope('a', () => scope('b', () => container({ id: 'x' }))).id).toBe('a-b-x');
    expect(() =>
      scope('a', () => {
        throw new Error('broken');
      })
    ).toThrow('broken');
    expect(container({ id: 'x' }).id).toBe('x');
  });
});
