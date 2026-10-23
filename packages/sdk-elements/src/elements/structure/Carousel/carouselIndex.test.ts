import { describe, expect, it } from 'vitest';

import { clampIndex, directionOf, rowEdges, slideEdges, stepIndex, stepOf } from './carouselIndex';

describe('carousel positions', () => {
  it('goes round the ends when it loops, and stops at them when it does not', () => {
    expect(stepIndex(3, 4, 1, true)).toBe(0);
    expect(stepIndex(0, 4, -1, true)).toBe(3);
    expect(stepIndex(3, 4, 1, false)).toBe(3);
    expect(stepIndex(0, 4, -1, false)).toBe(0);
    expect(stepIndex(0, 0, 1, true)).toBe(0);
  });

  it('takes a requested slide as one it has', () => {
    expect(clampIndex('2', 4)).toBe(2);
    expect(clampIndex(9, 4)).toBe(3);
    expect(clampIndex(-1, 4)).toBe(0);
    expect(clampIndex('next', 4)).toBe(0);
  });

  it('says which way a jump goes', () => {
    expect(directionOf(3, 1)).toBe('previous');
    expect(directionOf(1, 3)).toBe('next');
  });

  // lx-controls: a row showing three of five never brought its index to the last — its end could not be known.
  it('says where a scrolling row stands by its box: at either end, and how many slides it shows whole', () => {
    const row = (scrollLeft: number) => {
      const scroller = document.createElement('div');
      scroller.style.columnGap = '24px';
      const slide = document.createElement('div');
      scroller.append(slide);
      Object.defineProperty(slide, 'offsetWidth', { value: 431 });
      Object.defineProperties(scroller, {
        scrollLeft: { value: scrollLeft },
        clientWidth: { value: 1340 },
        scrollWidth: { value: 2251 }
      });

      return scroller;
    };

    expect(rowEdges(row(0))).toEqual({ atStart: true, atEnd: false, shown: 3 });
    expect(rowEdges(row(455))).toEqual({ atStart: false, atEnd: false, shown: 3 });
    expect(rowEdges(row(911))).toEqual({ atStart: false, atEnd: true, shown: 3 });
  });

  it('puts a carousel of one slide at a time at an end only where it stops', () => {
    expect(slideEdges(0, 3, false)).toEqual({ atStart: true, atEnd: false, shown: 1 });
    expect(slideEdges(2, 3, false)).toEqual({ atStart: false, atEnd: true, shown: 1 });
    expect(slideEdges(0, 3, true)).toEqual({ atStart: false, atEnd: false, shown: 1 });
  });

  it('reads how far a press moves: a page when a flow says so, a slide otherwise', () => {
    expect(stepOf('page')).toBe('page');
    expect(stepOf('slide')).toBe('slide');
    expect(stepOf(undefined)).toBe('slide');
  });
});
