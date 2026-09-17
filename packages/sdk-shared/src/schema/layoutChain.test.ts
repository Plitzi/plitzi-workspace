import { describe, expect, it } from 'vitest';

import { findLayoutCycle, resolveLayoutChain } from './layoutChain';

import type { Element } from '../types';

const layout = (id: string, attributes: Record<string, unknown> = {}): Element => ({
  id,
  attributes,
  definition: { rootId: id, label: id, type: 'layoutContainer', items: [], styleSelectors: { base: '' } }
});

const flatOf = (...elements: Element[]) => {
  const flat = Object.fromEntries(elements.map(element => [element.id, element]));

  return (id: string): Element | undefined => flat[id];
};

describe('resolveLayoutChain', () => {
  it('follows a shell into the shell it sits in, innermost first', () => {
    const get = flatOf(layout('shell'), layout('analytics', { layout: 'shell', layoutContainer: 'shell-body' }));

    expect(resolveLayoutChain(get, 'analytics', 'analytics-body')).toEqual([
      { layout: 'analytics', slot: 'analytics-body' },
      { layout: 'shell', slot: 'shell-body' }
    ]);
  });

  it('is one link for a page in a shell that sits in nothing', () => {
    expect(resolveLayoutChain(flatOf(layout('shell')), 'shell', 'body')).toEqual([{ layout: 'shell', slot: 'body' }]);
  });

  it('is empty without a layout, or for one the document does not hold', () => {
    expect(resolveLayoutChain(flatOf(), '', '')).toEqual([]);
    expect(resolveLayoutChain(flatOf(), 'gone', 'body')).toEqual([]);
  });

  it('stops at a shell already in the chain rather than looping', () => {
    const get = flatOf(layout('a', { layout: 'b', layoutContainer: 'b-body' }), layout('b', { layout: 'a' }));

    expect(resolveLayoutChain(get, 'a', 'a-body').map(link => link.layout)).toEqual(['a', 'b']);
  });
});

describe('findLayoutCycle', () => {
  it('names the shells that close on themselves', () => {
    const get = flatOf(layout('a', { layout: 'b' }), layout('b', { layout: 'a' }));

    expect(findLayoutCycle(get, 'a')).toEqual(['a', 'b', 'a']);
  });

  it('is empty for a chain that ends', () => {
    expect(findLayoutCycle(flatOf(layout('a', { layout: 'b' }), layout('b')), 'a')).toEqual([]);
  });
});
