import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { spendLine, spendPanel, tokensShort } from './monitorSpend';

import type { Spent } from '../../runs/spent';

const plain = (lines: string[]): string[] => lines.map(line => stripVTControlCharacters(line).trimEnd());

/** encore-3's tester after one spec: 17 turns, 92 % of what it read its context again. */
const tester: Spent = {
  agent: 'test-1',
  pieces: 1,
  tasks: ['t-player'],
  sessions: 1,
  turns: 17,
  input: 66_968,
  output: 6_197,
  cached: 1_253_308,
  context: 92_877
};
const developer: Spent = {
  agent: 'dev-1',
  pieces: 2,
  tasks: ['t-player', 't-queue'],
  sessions: 2,
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
      'SPEND  by IN+OUT ↓ (s) · cached: read again, a tenth the price',
      '  WHO     DONE  TASKS  SESS  TURNS    IN  OUT  CACHED  PER SESS  PER TASK  CONTEXT',
      '  test-1     1      1     1     17   67k   6k    1.3M       73k       73k     93k',
      '  dev-1      2      2     2      7   40k   3k    370k       22k       22k    140k!'
    ]);
    // t-player is dev-1's and test-1's: once for the run, every agent's spend on it in what a task cost.
    expect(shown.slice(6)).toEqual([
      '  all        3      2     3     24  107k   9k    1.6M       39k       58k',
      '  PER SESS · PER TASK: IN+OUT over its sessions · its tasks',
      '  ! past its freshContextAt: started fresh after its piece'
    ]);
  });

  // Carlos: every agent of encore-3 starts fresh after each piece, and the panel said "past 100k: started fresh next".
  it('marks no context of an agent that starts fresh after every piece, however large', () => {
    const lines = plain(spendPanel([tester, { ...developer, context: 400_000 }], new Map(), 20).lines);
    expect(lines.some(line => line.includes('!'))).toBe(false);
  });

  // Carlos: agents start fresh in different ways — a task each, past a size — so the spend says each one's sessions and
  // what one costs on average, to watch what a task costs.
  it('averages each agent over its sessions, and sorts by it', () => {
    const lines = plain(spendPanel([tester, developer], new Map(), 20, 'session').lines);
    expect(lines[1]).toContain('by PER SESS ↓');
    expect(lines.slice(3, 5).map(line => line.split(/\s+/)[1])).toEqual(['test-1', 'dev-1']);
  });

  // Carlos: the spend lacked what a task costs — an agent of `"session": "context"` works several in one session.
  it('averages each agent over the tasks it worked on, and sorts by it', () => {
    const many = { ...developer, sessions: 1, tasks: ['t-player', 't-queue', 't-home', 't-shell'] };
    const lines = plain(spendPanel([many, { ...tester, input: 30_000 }], new Map(), 20, 'task').lines);
    expect(lines[1]).toContain('by PER TASK ↓');
    expect(lines.slice(3, 5).map(line => line.split(/\s+/)[1])).toEqual(['test-1', 'dev-1']);
    expect(lines[4]).toMatch(/dev-1\s+2\s+4\s+1\s+7\s+40k\s+3k\s+370k\s+43k\s+11k/);
  });

  it('keeps the heaviest when the rows are few, and says the rest in one line', () => {
    const many = Array.from({ length: 6 }, (_, index): Spent => ({
      agent: `dev-${String(index + 1)}`,
      pieces: 1,
      tasks: [`t-${String(index + 1)}`],
      sessions: 1,
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
