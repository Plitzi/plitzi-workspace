import { describe, expect, it } from 'vitest';

import { describeData } from './data';

const catalog = {
  products: [
    { id: 'p1', title: 'Ryzen 7', price: 329, specs: ['8 cores', '16 threads'], sale: true },
    { id: 'p2', title: 'RTX 5070', price: 599, specs: [] },
    {
      id: 'p3',
      title: 'A very long title that somebody wrote for a product page and nobody ever shortened at all',
      price: null,
      specs: ['12 GB']
    }
  ],
  categories: ['cpu', 'gpu']
};

describe('describeData', () => {
  it('says every field once, with its type and how long each list is', () => {
    expect(describeData(catalog).shape).toBe(
      [
        '{',
        '  products: Array(3) of {',
        '    id: string',
        '    title: string',
        '    price: null | number',
        '    specs: string[]',
        '    sale?: boolean  (in 1 of 3)',
        '  }',
        '  categories: Array(2) of string',
        '}'
      ].join('\n')
    );
  });

  it('shows one row of the longest list of objects, shortened', () => {
    const { example } = describeData({ tags: [{ name: 'a' }], ...catalog });

    expect(example?.path).toBe('products');
    expect(example?.row).toEqual(catalog.products[0]);
    expect(describeData({ rows: [{ text: 'x'.repeat(200), list: [1, 2, 3, 4, 5] }] }).example?.row).toEqual({
      text: `${'x'.repeat(77)}…`,
      list: [1, 2, 3, '… 2 more']
    });
  });

  it('describes a document that is itself a list, or holds no rows at all', () => {
    expect(describeData([{ a: 1 }, { a: 2, b: 'x' }])).toEqual({
      shape: 'Array(2) of {\n  a: number\n  b?: string  (in 1 of 2)\n}',
      example: { path: '(the document)', row: { a: 1 } }
    });
    expect(describeData({ total: 3, empty: [] })).toEqual({ shape: '{\n  total: number\n  empty: Array(0)\n}' });
  });

  it('summarises an object keyed by ids rather than listing every key', () => {
    const byId = Object.fromEntries(Array.from({ length: 45 }, (_, index) => [`id${String(index)}`, index]));

    expect(describeData(byId).shape).toContain('… 5 more keys');
  });

  // Five hundred articles keyed by slug are one shape, not five hundred: described once, with how many keys.
  it('reads an object keyed by data as a map of one shape', () => {
    const { shape } = describeData({
      comments: {
        'first-post': [{ id: 'a', likes: 1 }],
        'second-post': [{ id: 'b', likes: 2 }, { id: 'c' }],
        'third-post': []
      }
    });

    expect(shape).toContain('comments: { [key]: {');
    expect(shape).toContain('(3 keys: "first-post", "second-post", "third-post")');
    expect(shape.match(/likes/g)).toHaveLength(1);
  });
});
