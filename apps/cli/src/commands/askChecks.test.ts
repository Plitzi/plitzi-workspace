import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { checksAfter, renderChecks } from './askChecks';

import type { ChecksState } from './askChecks';

const start: ChecksState = { cursor: 0, checked: [true, false, true] };

describe('checksAfter', () => {
  it('moves the cursor with the arrows and with j/k, round the ends', () => {
    expect(checksAfter(start, { name: 'down' })).toEqual({ ...start, cursor: 1 });
    expect(checksAfter(start, { name: 'j' })).toEqual({ ...start, cursor: 1 });
    expect(checksAfter(start, { name: 'up' })).toEqual({ ...start, cursor: 2 });
    expect(checksAfter({ ...start, cursor: 2 }, { name: 'k' })).toEqual({ ...start, cursor: 1 });
  });

  it('ticks the one under the cursor with space, and every one — or none — with a', () => {
    expect(checksAfter({ ...start, cursor: 1 }, { name: 'space' })).toEqual({ cursor: 1, checked: [true, true, true] });
    expect(checksAfter(start, { name: 'a' })).toEqual({ ...start, checked: [true, true, true] });
    expect(checksAfter({ ...start, checked: [true, true, true] }, { name: 'a' })).toEqual({
      ...start,
      checked: [false, false, false]
    });
  });

  it('takes the list with Enter, gives it up with Esc or Ctrl-C, and ignores any other key', () => {
    expect(checksAfter(start, { name: 'return' })).toBe('done');
    expect(checksAfter(start, { name: 'escape' })).toBe('cancel');
    expect(checksAfter(start, { name: 'c', ctrl: true })).toBe('cancel');
    expect(checksAfter(start, { name: 'c' })).toBe(start);
    expect(checksAfter(start, {})).toBe(start);
  });
});

describe('renderChecks', () => {
  it('draws the question, a box per option with the cursor on one, and the keys', () => {
    const lines = renderChecks(
      'What goes to Pizarra?',
      [
        { label: 'space', value: 'space', checked: true, hint: 'changed' },
        { label: 'functions', value: 'functions', checked: false }
      ],
      { cursor: 1, checked: [true, false] }
    ).map(line => stripVTControlCharacters(line));

    expect(lines).toEqual([
      'What goes to Pizarra?',
      '  [x] space  changed',
      '› [ ] functions',
      '  ↑/↓ move · space ticks · a all · enter takes · esc cancels'
    ]);
  });
});
