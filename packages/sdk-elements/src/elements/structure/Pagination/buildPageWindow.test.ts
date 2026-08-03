import { describe, expect, it } from 'vitest';

import buildPageWindow from './buildPageWindow';

describe('buildPageWindow', () => {
  it('centres the window on the current page', () => {
    expect(buildPageWindow(5, 10, 5)).toEqual([3, 4, 5, 6, 7]);
  });

  it('clamps to the start', () => {
    expect(buildPageWindow(1, 10, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('clamps to the end', () => {
    expect(buildPageWindow(10, 10, 5)).toEqual([6, 7, 8, 9, 10]);
  });

  it('never shows more pages than exist', () => {
    expect(buildPageWindow(1, 3, 5)).toEqual([1, 2, 3]);
  });

  // A provider that reports no total leaves prev/next to carry the interaction; inventing numbers would show a
  // pager that claims to know how long the list is.
  it('shows nothing when the page count is unknown', () => {
    expect(buildPageWindow(1, 0, 5)).toEqual([]);
  });
});
