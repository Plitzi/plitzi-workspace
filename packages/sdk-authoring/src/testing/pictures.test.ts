import { describe, expect, it } from 'vitest';

import { alignPictures } from './pictures';

import type { PictureRegion, RowProfile } from './pictures';

/** A row of content, the same wherever it is drawn: what a section looks like, read in one band. */
const content = (row: number): number[] => [(row * 37) % 251, (row * 101) % 241, (row * 53) % 239];

const profile = (rows: number[][]): RowProfile => ({ width: 100, height: rows.length, columns: 1, rows: rows.flat() });

const range = (from: number, to: number): number[] => Array.from({ length: to - from }, (_, index) => from + index);

const region = (name: string, y: number, height: number): PictureRegion => ({ name, x: 0, y, width: 100, height });

describe('alignPictures', () => {
  // The second page has 40 rows more inside its first section: everything under them is 40 rows further down.
  const here = profile([...range(0, 500).map(content), ...range(0, 50).map(() => [0, 0, 0])]);
  const there = profile([
    ...range(0, 100).map(content),
    ...range(0, 40).map(() => [255, 255, 255]),
    ...range(100, 500).map(content),
    ...range(0, 160).map(() => [0, 0, 0])
  ]);
  const regions = [
    region('footer', 500, 50),
    region('header', 0, 100),
    region('section#plans', 100, 200),
    region('section#faq', 300, 200)
  ];

  it('finds each section where the other page has it, and the first one that moved', () => {
    const { shifts, drift } = alignPictures(here, there, regions);

    expect(shifts).toEqual([40, 0, 40, 40]);
    expect(drift).toEqual({ name: 'section#plans', shift: 40 });
  });

  it('names the section the drift starts at, not the main around it', () => {
    expect(alignPictures(here, there, [region('main', 100, 400), ...regions]).drift).toEqual({
      name: 'section#plans',
      shift: 40
    });
  });

  it('keeps a blank band where the section above it went, rather than anywhere it fits', () => {
    expect(
      alignPictures(here, there, [region('header', 0, 100), region('section#faq', 300, 200), region('footer', 500, 50)])
        .shifts
    ).toEqual([0, 40, 40]);
  });

  it('says how far each row moved, the row no region holds keeping the one above it', () => {
    const { rowShift } = alignPictures(here, there, [region('header', 0, 100), region('section#faq', 300, 100)]);

    expect([rowShift[50], rowShift[350], rowShift[450]]).toEqual([0, 40, 40]);
  });

  it('finds a block inserted above a footer that keeps both pages the same height', () => {
    const page = (rows: number[][]) => profile([...rows, ...range(0, 600 - rows.length).map(() => [0, 0, 0])]);
    const one = page(range(0, 200).map(content));
    const two = page([
      ...range(0, 40).map(content),
      ...range(0, 300).map(() => [229, 229, 229]),
      ...range(40, 200).map(content)
    ]);

    expect(alignPictures(one, two, [region('header', 0, 40), region('section#hero', 40, 160)]).shifts).toEqual([
      0, 300
    ]);
  });

  it('says nothing moved when the pages are the same', () => {
    const { shifts, drift } = alignPictures(here, here, regions);

    expect(shifts).toEqual([0, 0, 0, 0]);
    expect(drift).toBeUndefined();
  });
});
