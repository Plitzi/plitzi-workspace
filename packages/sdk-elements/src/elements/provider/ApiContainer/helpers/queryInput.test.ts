import { describe, expect, it } from 'vitest';

import { queryInputOf } from './queryInput';

describe('queryInputOf', () => {
  it('reads an object as authored, each value a string', () => {
    expect(queryInputOf({ q: 'retro', page: 2, open: true })).toEqual({ q: 'retro', page: '2', open: 'true' });
  });

  it('reads the JSON text the editor keeps', () => {
    expect(queryInputOf('{"q":"kanban"}')).toEqual({ q: 'kanban' });
    expect(queryInputOf('')).toEqual({});
  });

  it('leaves out what a query param cannot be, and is no input for what is not an object', () => {
    expect(queryInputOf({ q: 'a', nested: { x: 1 }, list: [1] })).toEqual({ q: 'a' });
    expect(queryInputOf('not json')).toBeUndefined();
    expect(queryInputOf([1, 2])).toBeUndefined();
    expect(queryInputOf(undefined)).toBeUndefined();
  });
});
