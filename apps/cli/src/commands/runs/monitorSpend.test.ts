import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { SPEND_WIDTH, spendLine, spendLines, tokensShort } from './monitorSpend';

const plain = (lines: string[]): string[] => lines.map(line => stripVTControlCharacters(line).trimEnd());

describe("the monitor's spend", () => {
  it('lists each agent, the most read first, with its context — said apart past a fresh start', () => {
    const lines = spendLines(
      [
        { agent: 'test-1', pieces: 6, turns: 224, read: 30_655_798, context: 400_422 },
        { agent: 'dev-1', pieces: 9, turns: 305, read: 4_800_000, context: 72_000 }
      ],
      100_000,
      20
    );

    expect(lines.every(line => stripVTControlCharacters(line).length === SPEND_WIDTH)).toBe(true);
    expect(plain(lines)).toEqual([
      '',
      'SPEND  tokens read by each agent',
      '  WHO        DONE    READ  CONTEXT',
      '  test-1        6     31M     400k!',
      '  dev-1         9    4.8M      72k',
      `  ${'─'.repeat(SPEND_WIDTH - 4)}`,
      '  all          15     35M',
      '  2.4M a piece of work',
      '  ! past 100k: started fresh next'
    ]);
  });

  it('keeps the heaviest when the rows are few, and says the rest in one line', () => {
    const many = Array.from({ length: 6 }, (_, index) => ({
      agent: `dev-${String(index + 1)}`,
      pieces: 1,
      turns: 10,
      read: (6 - index) * 1_000_000,
      context: 50_000
    }));

    const lines = plain(spendLines(many, 100_000, 9));
    expect(lines).toHaveLength(9);
    expect(lines).toContain('  +4 more');
  });

  it('says it in one line over the activity on a narrow terminal, and nothing before anything ended', () => {
    expect(
      stripVTControlCharacters(
        spendLine([{ agent: 'dev-1', pieces: 1, turns: 10, read: 950_000, context: 60_000 }], 60)
      )
    ).toBe('SPEND 950k read — dev-1 950k'.padEnd(60));
    expect(spendLine([], 60)).toBe('');
    expect(tokensShort(950)).toBe('950');
  });
});
