import { describe, expect, it } from 'vitest';

import pathFields from './pathFields';

describe('pathFields', () => {
  it('lists every path, named by its last two segments', () => {
    expect(pathFields({ total: 1, series: { day: '1 Aug' } })).toEqual([
      { path: 'total', name: 'total' },
      { path: 'series', name: 'series' },
      { path: 'series.day', name: 'series day' }
    ]);
  });
});
