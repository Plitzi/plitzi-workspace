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
  decorations: [],
  unloaded: 0,
  sideBySide: 'side.png',
  diff: 'diff.png'
};

describe('a comparison with another site, said', () => {
  it('leads with the one section a clip keeps, the whole page’s figure beside it', () => {
    const [first] = compareText({ ...report, section: 'hero' }).map(line => stripVTControlCharacters(line));
    expect(first).toBe(
      'section#hero 31% differs from https://example.com/ (the whole page 12%; its dress and texts below are its own)'
    );
    expect(stripVTControlCharacters(compareText(report)[0])).toBe(
      '12% differs from https://example.com/ — section#hero 31%'
    );
  });

  // la-velada's artist page lost the original's warm light, its portrait's corners and its card's halo: a few percent
  // of pixels, and no text — three reviews passed it. Said by section, before the words.
  it('says the dress a section has there and not here — and what it adds — before the words', () => {
    const lines = compareText({
      ...report,
      texts: { same: 0, differ: [], onlyHere: [], onlyThere: ['Maxibon'] },
      decorations: [
        {
          section: 'section#artist-page',
          here: {},
          there: { gradient: 2, glow: 1, ornament: 4 },
          missing: [
            'radial-gradient rgba(199, 168, 107, 0.2) ×2',
            'box-shadow 60px rgba(199, 168, 107, 0.25)',
            '::before border rgb(199, 168, 107) ×4'
          ],
          extra: []
        }
      ]
    }).map(line => stripVTControlCharacters(line));

    expect(lines[1]).toBe('dress (gradients, glows, ornaments, background images), by section — here → there:');
    expect(lines[2]).toBe(
      '  section#artist-page: none → 2 gradients, 1 glow, 4 ornaments — add: radial-gradient rgba(199, 168, 107, 0.2) ×2; box-shadow 60px rgba(199, 168, 107, 0.25); ::before border rgb(199, 168, 107) ×4'
    );
  });
});
