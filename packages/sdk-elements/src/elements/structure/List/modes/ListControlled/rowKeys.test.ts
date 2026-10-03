import { describe, expect, it } from 'vitest';

import { rowKeys } from './rowKeys';

describe('rowKeys', () => {
  it('names each row by the field the list chose', () => {
    expect(rowKeys([{ slug: 'a' }, { slug: 'b' }], 'slug')).toEqual(['slug:a', 'slug:b']);
  });

  it('falls back to the id, then to the position, when that field is missing or shared', () => {
    expect(rowKeys([{ slug: 'a', id: 1 }, { id: 2 }], 'slug')).toEqual(['id:1', 'id:2']);
    expect(rowKeys([{ slug: 'a' }, { slug: 'a' }], 'slug')).toEqual([0, 1]);
    expect(rowKeys(['x', 'y'])).toEqual([0, 1]);
  });
});
