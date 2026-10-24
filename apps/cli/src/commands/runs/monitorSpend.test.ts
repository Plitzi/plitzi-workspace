import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { spendLine, spendPanel, tokensShort } from './monitorSpend';

import type { Spent } from '../../runs/spent';

const plain = (lines: string[]): string[] => lines.map(line => stripVTControlCharacters(line).trimEnd());

/** encore-3's tester after one spec: 17 turns, 92 % of what it read its context again. */
const tester: Spent = {
  agent: 'test-1',
  pieces: 1,
  turns: 17,
  input: 66_968,
  output: 6_197,
  cached: 1_253_308,
  context: 92_877
};
const developer: Spent = {
  agent: 'dev-1',
  pieces: 1,
  turns: 7,
  input: 40_000,
  output: 3_000,
  cached: 370_000,
  context: 140_000
};

describe("the monitor's spend", () => {
  it('says tokens in, out and cached apart, as wide as it says, a context past a fresh start marked', () => {
    const { lines, width } = spendPanel([tester, developer], new Map([['dev-1', 100_000]]), 20);

    expect(lines.every(line => stripVTControlCharacters(line).length === width)).toBe(true);
    const shown = plain(lines);
    expect(shown.slice(1, 5)).toEqual([
      'SPEND  tokens in, out, and cached — read again, a tenth the price',
      '  WHO     DONE  TURNS    IN  OUT  CACHED  CONTEXT',
      '  test-1     1     17   67k   6k    1.3M     93k',
      '  dev-1      1      7   40k   3k    370k    140k!'
    ]);
    expect(shown.slice(6)).toEqual([
      '  all        2     24  107k   9k    1.6M',
      '  a piece of work: 53k in · 5k out · 812k cached',
      '  ! past its freshContextAt: started fresh after its piece'
    ]);
  });

  // Carlos: every agent of encore-3 starts fresh after each piece, and the panel said "past 100k: started fresh next".
  it('marks no context of an agent that starts fresh after every piece, however large', () => {
    const lines = plain(spendPanel([tester, { ...developer, context: 400_000 }], new Map(), 20).lines);
    expect(lines.some(line => line.includes('!'))).toBe(false);
  });

  it('keeps the heaviest when the rows are few, and says the rest in one line', () => {
    const many = Array.from({ length: 6 }, (_, index): Spent => ({
      agent: `dev-${String(index + 1)}`,
      pieces: 1,
      turns: 10,
      input: (6 - index) * 10_000,
      output: 1_000,
      cached: 100_000,
      context: 50_000
    }));

    const { lines } = spendPanel(many, new Map(), 9);
    expect(lines).toHaveLength(9);
    expect(plain(lines)).toContain('  +4 more');
  });

  it('says it in one line when beside would leave the activity too narrow, and nothing before anything ended', () => {
    expect(stripVTControlCharacters(spendLine([tester], 120)).trimEnd()).toBe(
      'SPEND 67k in · 6k out · 1.3M cached — test-1 73k'
    );
    expect(spendLine([], 60)).toBe('');
    expect(tokensShort(950)).toBe('950');
  });
});
