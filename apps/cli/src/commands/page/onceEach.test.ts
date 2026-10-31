import { describe, expect, it } from 'vitest';

import { onceEach } from './measure';
import { hiddenCopiesJoined } from './measureText';

import type { Reading } from './measure';

// A run's designer read one failed action four times a width, once for each element measured after it.
describe('a measure’s lines', () => {
  it('says each once, with how many times it came', () => {
    expect(onceEach(['✗ the action failed', 'a: 10', '✗ the action failed', 'b: 12', '✗ the action failed'])).toEqual([
      '✗ the action failed (×3)',
      'a: 10',
      'b: 12'
    ]);
  });
});

// A run's tester measured a sheet pane's rows at 390, the pane closed: the same "hidden" sentence seventeen times.
describe('copies of one element, every one hidden', () => {
  const copy = (index: number, hidden?: string): Reading => ({
    width: 390,
    pair: { here: `[data-plitzi-el="contact-meta"] >> nth=${String(index)}`, there: 'contact-meta' },
    here: {
      selector: `[data-plitzi-el="contact-meta"] >> nth=${String(index)}`,
      tag: 'p',
      text: '',
      box: { x: 0, y: 0, width: 0, height: 0 },
      styles: {},
      inherited: [],
      ...(hidden === undefined ? {} : { hidden })
    },
    unlike: []
  });

  it('are said in one line, where they came', () => {
    const joined = hiddenCopiesJoined([0, 1, 2].map(index => copy(index, 'display: none on sheet-log, around it')));

    expect(joined).toEqual([
      {
        said: '[data-plitzi-el="contact-meta"]: all 3 copies — a visitor sees none of what it finds — display: none on sheet-log, around it; its place and size are not on the page, so not said'
      }
    ]);
  });

  it('are read each when one is shown', () => {
    expect(hiddenCopiesJoined([copy(0, 'display: none'), copy(1)])).toHaveLength(2);
  });
});
