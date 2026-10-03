import { describe, expect, it } from 'vitest';

import { scrollDistance, scrollPosition, scrollState } from './scroll';

const row = { scrollLeft: 0, scrollTop: 0, scrollWidth: 1000, scrollHeight: 100, clientWidth: 400, clientHeight: 100 };

describe('scrollDistance', () => {
  it('reads pixels, and a share of what the box shows', () => {
    expect(scrollDistance(240, 400)).toBe(240);
    expect(scrollDistance('240px', 400)).toBe(240);
    expect(scrollDistance('80%', 400)).toBe(320);
    expect(scrollDistance('-50%', 400)).toBe(-200);
  });

  it('is nothing for nothing, or for text that is not a length', () => {
    expect(scrollDistance(undefined, 400)).toBeUndefined();
    expect(scrollDistance('', 400)).toBeUndefined();
    expect(scrollDistance('a bit', 400)).toBeUndefined();
  });
});

describe('scrollPosition', () => {
  it('goes to either end, a pixel or a share of the way, never past the ends', () => {
    expect(scrollPosition('start', 1000, 400)).toBe(0);
    expect(scrollPosition('end', 1000, 400)).toBe(600);
    expect(scrollPosition('50%', 1000, 400)).toBe(300);
    expect(scrollPosition(5000, 1000, 400)).toBe(600);
    expect(scrollPosition(undefined, 1000, 400)).toBeUndefined();
  });
});

describe('scrollState', () => {
  it('says the ends of the way a row scrolls: across', () => {
    expect(scrollState(row)).toEqual({ x: 0, y: 0, atStart: true, atEnd: false });
    expect(scrollState({ ...row, scrollLeft: 599.6 })).toEqual({ x: 600, y: 0, atStart: false, atEnd: true });
  });

  it('and of a column: down', () => {
    const column = { ...row, scrollWidth: 400, scrollHeight: 900, scrollTop: 300, clientHeight: 300 };

    expect(scrollState(column)).toEqual({ x: 0, y: 300, atStart: false, atEnd: false });
  });
});
