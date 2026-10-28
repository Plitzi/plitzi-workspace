import { describe, expect, it } from 'vitest';

import { firstShown } from './click';

/** One copy a locator's `first` lands on: its name, or none. */
const copy = (name: string | undefined) => ({ name, count: () => Promise.resolve(name === undefined ? 0 : 1) });

/** An element's copies as a locator holds them, each shown or not. */
const copies = (rows: { name: string; visible: boolean }[]) => ({
  first: () => copy(rows.at(0)?.name),
  filter: (options: { visible: boolean }) => ({
    first: () => copy(rows.find(row => row.visible === options.visible)?.name)
  })
});

// A list's first row hid its Remind key — on air — and a click on the first copy "could not be brought into view".
describe('the copy of an element a click or a fill takes', () => {
  it('is the first a visitor sees — else the first, for the answer to say it is not shown', async () => {
    const rows = [
      { name: 'row-1', visible: false },
      { name: 'row-2', visible: true },
      { name: 'row-3', visible: true }
    ];

    expect((await firstShown(copies(rows))).name).toBe('row-2');
    expect((await firstShown(copies(rows.map(row => ({ ...row, visible: false }))))).name).toBe('row-1');
  });
});
