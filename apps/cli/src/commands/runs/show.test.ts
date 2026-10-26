import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { notesLines, roundText } from './show';

// A lead read one task's show — 16k characters — four times in nine minutes, its notes whole every time.
describe('a task’s notes, shown', () => {
  it('are the latest ten, each clipped, the rest one --full away', () => {
    const notes = Array.from({ length: 12 }, (_, index) => ({ by: 'dev-1', text: `Note ${String(index + 1)}` }));
    notes.push({ by: 'lead', text: `Review 1: ${'the hero wraps at 390. '.repeat(30)}` });

    const lines = notesLines(notes, false).map(line => stripVTControlCharacters(line));
    expect(lines[0]).toBe('Notes (the last 10 — 3 earlier: --full)');
    expect(lines).not.toContain('  dev-1: Note 3');
    expect(lines).toContain('  dev-1: Note 4');
    expect(lines.at(-1)).toMatch(/^ {2}lead: Review 1: .{280,}… \(whole: --full\)$/);
    expect(lines.at(-1)?.length).toBeLessThan(340);

    expect(notesLines(notes, true)).toHaveLength(14);
    expect(notesLines([], false)).toEqual([]);
  });
});

// encore-10's show said "in-review, round 1" of a task its tester was at the second round of, as `task next` said.
describe('a task’s round, shown', () => {
  it('is the one being reviewed while in review, as task next says it', () => {
    expect(roundText({ status: 'in-review', round: 0 })).toBe(', round 1');
    expect(roundText({ status: 'in-review', round: 1 })).toBe(', round 2');
    expect(roundText({ status: 'in-progress', round: 1 })).toBe(', round 1');
    expect(roundText({ status: 'ready', round: 0 })).toBe('');
  });
});
