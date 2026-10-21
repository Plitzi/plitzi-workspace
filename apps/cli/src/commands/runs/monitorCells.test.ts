import { stripVTControlCharacters } from 'node:util';

import chalk from 'chalk';
import { describe, expect, it } from 'vitest';

import { cell } from './monitorCells';

describe('a cell of the monitor', () => {
  // An approved card with a long id was cut to plain text: white in a column of green.
  it('keeps the colours of a line it cuts, and resets them where it ends', () => {
    const level = chalk.level;
    chalk.level = 1;
    const cut = cell(`${chalk.green('integrate-src-space-pages-home-index-ts')}${chalk.dim(' lead')}`, 20);
    chalk.level = level;

    expect(stripVTControlCharacters(cut)).toBe('integrate-src-space…');
    expect(cut.startsWith('\x1b[32m')).toBe(true);
    expect(cut.endsWith('\x1b[0m')).toBe(true);
  });

  it('pads a line that fits, and cuts a plain one with no style to reset', () => {
    expect(cell('t-home', 8)).toBe('t-home  ');
    expect(cell('t-home-details', 8)).toBe('t-home-…');
  });
});
