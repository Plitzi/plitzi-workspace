import { describe, expect, it } from 'vitest';

import { importedLines } from './brief';

// A room's forty classes, each with how it is "called", were 3k of an 18k brief read five times.
describe('what a task’s files import, in its brief', () => {
  it('says a module’s classes in one line, by name, and the rest each with its signature', () => {
    expect(
      importedLines([
        "roomAmbient = styles('room-ambient', …) — The ambient light behind the deck.",
        "roomDeck = styles('room-deck', …)",
        'crateKey({ id, source }: CrateKey): ElementSpec[] — The Save key.'
      ])
    ).toEqual([
      '  classes: roomAmbient, roomDeck',
      '  crateKey({ id, source }: CrateKey): ElementSpec[] — The Save key.'
    ]);
  });

  // A run's map component imported 38 names from nine modules: 5.6k of a 14.5k brief, half of it docs.
  it('says each signature whole and its doc short, and past eight names, the rest by name', () => {
    const names = Array.from(
      { length: 10 },
      (_, index) =>
        `shaking${String(index)}(shaking: Shaking): Position[] — The labels a shaking map's contours carry, one at each contour's middle, for the reader.`
    );
    const lines = importedLines(names, 'src/plugins/SeismicMap/geo.ts');

    expect(lines).toHaveLength(9);
    expect(lines[0]).toBe(
      "  shaking0(shaking: Shaking): Position[] — The labels a shaking map's contours carry, one at each…"
    );
    expect(lines[8]).toBe('  also shaking8, shaking9 — how each is called: src/plugins/SeismicMap/geo.ts');
  });
});
