import { describe, expect, it } from 'vitest';

import { ParamsFromURL } from './utils';

// encore-10: /sign-in?next=/rooms?x=1 read next as '/rooms?x' — a value was cut at its second '='.
describe('a query string’s parameters', () => {
  it('keep every = of a value after its first, as the URL standard reads them', () => {
    expect(ParamsFromURL('?next=/rooms?x=1')).toEqual({ next: '/rooms?x=1' });
    expect(ParamsFromURL('?next=%2Frooms%3Fx%3D1')).toEqual({ next: '/rooms?x=1' });
  });

  it('decode each value once, + as a space, and a bare name as empty', () => {
    expect(ParamsFromURL('?q=caf%C3%A9+lumen&pct=100%2525&flag')).toEqual({ q: 'café lumen', pct: '100%25', flag: '' });
  });

  it('list a name given more than once', () => {
    expect(ParamsFromURL('?tag=a&tag=b&tag=c')).toEqual({ tag: ['a', 'b', 'c'] });
    expect(ParamsFromURL('')).toEqual({});
  });
});
