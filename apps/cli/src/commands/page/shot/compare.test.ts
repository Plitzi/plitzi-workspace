import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { compareText, missingDress } from './compare';

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
  // Sponsors in light against an original with no light scheme — 99.5%, 2526px off — read as the section's.
  it('says a clipped section lined up with something else, before its figures are read', () => {
    const lines = compareText({
      ...report,
      section: 'hero',
      misaligned: 'hero lined up with a part of x that is not it'
    }).map(line => stripVTControlCharacters(line));
    expect(lines[1]).toBe('⚠ hero lined up with a part of x that is not it');
  });

  it('leads with the one section a clip keeps, the whole page’s figure beside it', () => {
    const [first] = compareText({ ...report, section: 'hero' }).map(line => stripVTControlCharacters(line));
    expect(first).toBe(
      'section#hero 31% differs from https://example.com/ (the whole page 12%; its dress and texts below are its own)'
    );
    expect(stripVTControlCharacters(compareText(report)[0])).toBe(
      '12% differs from https://example.com/ — section#hero 31%'
    );
  });

  // A run's artist page lost the original's warm light, its portrait's corners and its card's halo: a few percent
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
          extra: [],
          absent: [],
          absentLayers: []
        }
      ]
    }).map(line => stripVTControlCharacters(line));

    expect(lines[1]).toBe(
      'dress (gradients, glows, ornaments, background images), by section — layers here → there, and the looks there none here has (what --dress fails on; --json lists every layer):'
    );
    // What there is more of, drawn another way here, is no line to act on: --json has it.
    expect(lines[2]).toBe('  section#artist-page: none → 2 gradients, 1 glow, 4 ornaments');
  });

  // An acceptance proves a look by `--dress`: a look wholly absent fails, two ways of drawing one look do not.
  it('says each look a section lacks', () => {
    expect(
      missingDress([
        {
          section: 'section#artist-page',
          here: { gradient: 4 },
          there: { gradient: 12, glow: 2 },
          missing: [],
          extra: [],
          absent: ['radial-gradient across the section (radial-gradient rgba(199, 168, 107, 0.16))'],
          absentLayers: []
        },
        {
          section: 'section#home-sponsors',
          here: { gradient: 96 },
          there: { gradient: 1 },
          missing: [],
          extra: [],
          absent: [],
          absentLayers: []
        }
      ])
    ).toEqual([
      'section#artist-page lacks radial-gradient across the section (radial-gradient rgba(199, 168, 107, 0.16))'
    ]);
  });

  // "lacks radial-gradient" said what, never on which of our elements — a developer looked for it.
  it('says the element of ours where the other page wears a look this one lacks', () => {
    const look = 'box-shadow (box-shadow 48px rgba(199, 168, 107, 0.1))';
    expect(
      missingDress([
        {
          section: 'section#match-page',
          here: {},
          there: { glow: 1 },
          missing: [],
          extra: [],
          absent: [look],
          absentLayers: [],
          absentOn: { [look]: 'match-result' }
        }
      ])
    ).toEqual([`section#match-page lacks ${look} — at ours: match-result`]);
  });
});
