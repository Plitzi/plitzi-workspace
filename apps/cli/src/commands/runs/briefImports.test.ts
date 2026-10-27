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
});
