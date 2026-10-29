import { describe, expect, it } from 'vitest';

import { newFindings, reportOf, reportText } from '.';

import type { LintFinding } from './types';

/** A finding as the rules give one: what these tests read of it. */
const at = (
  file: string,
  line: number,
  code = 'positional-id',
  message = 'An element named by its place'
): LintFinding => ({
  code,
  severity: 'warning',
  origin: 'source',
  message,
  file,
  line,
  docs: 'plitzi explain positional-id'
});

// A run's tester linted two folders with a script of its own to see what a refactor added — and a run's lint said one
// sentence again in every file, 20k a call.
describe('space lint against another copy', () => {
  it('says only what is new here, its lines moved or not, and counts what is alike and gone', () => {
    const there = [at('src/space/board.ts', 10), at('src/space/board.ts', 20), at('src/space/map.ts', 5)];
    const here = [
      at('src/space/board.ts', 14),
      at('src/space/board.ts', 24),
      at('src/space/board.ts', 30),
      at('src/space/log.ts', 2)
    ];

    expect(newFindings(here, there)).toEqual({
      fresh: [at('src/space/board.ts', 30), at('src/space/log.ts', 2)],
      same: 2,
      gone: 1
    });
  });

  it('says a message once, and names it by its code where it comes again', () => {
    const report = reportOf(
      { root: '/p', name: 'p', entry: 'src/space/index.ts', files: 2 },
      [at('src/space/board.ts', 1), at('src/space/log.ts', 1)],
      { strict: false }
    );
    const text = reportText(report);

    expect(text.match(/An element named by its place/g)).toHaveLength(1);
    expect(text).toContain('as above');
  });
});
