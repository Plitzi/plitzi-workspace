import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { notesLines, roundText } from './show';

// A lead read one task's show — 16k characters — four times in nine minutes, its notes whole every time; said inside
// `task next` too, a bare "--full" was tried on `task context`, which has none.
describe('a task’s notes, shown', () => {
  it('are the latest ten, each clipped, the rest one command away — named whole', () => {
    const notes = Array.from({ length: 12 }, (_, index) => ({ by: 'dev-1', text: `Note ${String(index + 1)}` }));
    notes.push({ by: 'lead', text: `Review 1: ${'the hero wraps at 390. '.repeat(30)}` });

    const lines = notesLines(notes, false, 't-home').map(line => stripVTControlCharacters(line));
    expect(lines[0]).toBe('Notes (the last 10 — 3 earlier: plitzi task show t-home --full)');
    expect(lines).not.toContain('  dev-1: Note 3');
    expect(lines).toContain('  dev-1: Note 4');
    expect(lines.at(-1)).toMatch(/^ {2}lead: Review 1: .{280,}… \(whole: plitzi task show t-home --full\)$/);
    expect(lines.at(-1)?.length).toBeLessThan(370);

    expect(notesLines(notes, true, 't-home')).toHaveLength(14);
    expect(notesLines([], false, 't-home')).toEqual([]);
  });
});

// A run's show said "in-review, round 1" of a task its tester was at the second round of, as `task next` said.
describe('a task’s round, shown', () => {
  it('is the one being reviewed while in review, as task next says it', () => {
    expect(roundText({ status: 'in-review', round: 0 })).toBe(', round 1');
    expect(roundText({ status: 'in-review', round: 1 })).toBe(', round 2');
    expect(roundText({ status: 'in-progress', round: 1 })).toBe(', round 1');
    expect(roundText({ status: 'ready', round: 0 })).toBe('');
  });
});
