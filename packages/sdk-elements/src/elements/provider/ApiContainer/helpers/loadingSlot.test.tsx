import { describe, expect, it } from 'vitest';

import { childrenWhile } from './loadingSlot';

const children = [<p key="skeleton">…</p>, <ul key="rows" />, <p key="empty">Nothing yet</p>];

const keysOf = (nodes: ReturnType<typeof childrenWhile>): string[] =>
  nodes.map(node => (typeof node === 'object' && node !== null && 'key' in node ? String(node.key) : ''));

describe('childrenWhile', () => {
  it('shows the slot alone while the first answer is on its way', () => {
    expect(keysOf(childrenWhile(children, 'skeleton', true))).toEqual(['.$skeleton']);
  });

  it('shows everything but the slot once it has answered', () => {
    expect(keysOf(childrenWhile(children, 'skeleton', false))).toEqual(['.$rows', '.$empty']);
  });
});
