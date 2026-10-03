import { describe, expect, it } from 'vitest';

import { authorSpace, button, component, container, list, text } from '../index';

import type { ComponentSpec, ElementSpec, SpaceSpec } from './types';

const card: ComponentSpec = {
  id: 'product-card',
  props: { item: { type: 'json', description: 'The product' } },
  root: container({ id: 'card-root', children: [text({ id: 'card-title', from: 'props.item.title' })] })
};

const space = (body: ElementSpec[]): SpaceSpec => ({
  name: 'Rows',
  permanentUrl: 'rows',
  components: [card],
  pages: [{ id: 'home', name: 'Home', slug: '', body }]
});

describe('a list', () => {
  it('is controlled once it has items: its own, or a source named in their place', () => {
    const own = list({ items: ['a', 'b'] });
    const bound = list({ items: 'state.rows' });

    expect(own.attributes).toMatchObject({ source: 'controlled', items: ['a', 'b'] });
    expect(bound.attributes?.items).toEqual([]);
    expect(bound.bind).toEqual([{ to: 'items', source: 'state.rows' }]);
  });

  it('writes its row from a function handed the row’s names', () => {
    const rows = list({
      id: 'rows',
      items: 'state.rows',
      row: r => button({ content: '', title: `Row {{ ${r.inTemplate.index} }}`, from: `${r.item}.label` })
    });

    const [row] = rows.children ?? [];

    expect(rows.children).toHaveLength(1);
    expect(row.from).toBe('rows.item.label');
    expect(row.attributes?.title).toBe('Row {{ list_rows.index }}');
  });

  it('places a component per row with the row bound to its item — the instance component() writes', () => {
    const short = authorSpace(space([list({ id: 'grid', items: 'state.products', row: 'product-card' })]));
    const long = authorSpace(
      space([
        list({
          id: 'grid',
          source: 'controlled',
          bind: { items: 'state.products' },
          children: [component('product-card', { bind: [{ to: 'item', source: 'grid.item' }] })]
        })
      ])
    );

    expect(short.schema).toEqual(long.schema);
  });

  it('is refused a row it cannot place', () => {
    expect(() => authorSpace(space([list({ id: 'grid', items: [], row: 'product-cart' })]))).toThrow(
      /\[row-component\].*did you mean "product-card"/s
    );
    expect(() => list({ items: [], row: r => text({ from: r.item }) })).toThrow(/\[row-without-id\]/);
    expect(() => list({ id: 'x', items: [], row: 'product-card', children: [] })).toThrow(/\[row-and-children\]/);
    expect(() => container({ row: 'product-card' })).toThrow(/\[row-outside-list\]/);
  });
});
