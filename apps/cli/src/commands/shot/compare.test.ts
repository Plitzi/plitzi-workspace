import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { compareText } from './compare';

import type { CompareReport } from './types';

const report: CompareReport = {
  url: 'https://example.com/',
  changed: 12,
  heights: { here: 2000, there: 2000 },
  regions: [{ name: 'section#hero', changed: 31 }],
  texts: { same: 4, differ: [], onlyHere: [], onlyThere: [] },
  unloaded: 0,
  sideBySide: 'side.png',
  diff: 'diff.png'
};

describe('a comparison with another site, said', () => {
  it('leads with the one section a clip keeps, the whole page’s figure beside it', () => {
    const [first] = compareText({ ...report, section: 'hero' }).map(line => stripVTControlCharacters(line));
    expect(first).toBe(
      'section#hero 31% differs from https://example.com/ (the whole page 12%; the rest below is the whole page’s)'
    );
    expect(stripVTControlCharacters(compareText(report)[0])).toBe(
      '12% differs from https://example.com/ — section#hero 31%'
    );
  });
});
