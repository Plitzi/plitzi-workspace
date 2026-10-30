import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { triedText, tryLinesOnProject, verdictOf } from './tryLines';

import type { RunContext } from '../run';

const REFERENCE = 'https://www.example.com';

// The lead dry-ran a stage's 13 lines by hand, and four lines of a later stage were never run on ours —
// 16 checks of one task failed on them, not the work.
describe('a stage’s lines, run once on the run’s work', () => {
  it('says each for what it is: passing already, failing for its value, ours not built, theirs not there, refused', () => {
    const result = (ok: boolean, output: string[] = [], unanswered = false) => ({
      said: 'A line',
      check: 'plitzi page measure …',
      ok,
      output,
      ...(unanswered ? { unanswered: true as const } : {})
    });

    expect(verdictOf(result(true), REFERENCE)).toBe('passes');
    expect(verdictOf(result(false, ['≠ height 465px → 365px']), REFERENCE)).toBe('value');
    expect(verdictOf(result(false, ['product-dot is not on http://127.0.0.1:4793/products/x'], true), REFERENCE)).toBe(
      'ours-missing'
    );
    expect(
      verdictOf(result(false, ['✗ No element .js-media-list on https://www.example.com/products/x'], true), REFERENCE)
    ).toBe('theirs-missing');
    expect(verdictOf(result(false, ['error: unknown option --same-y'], true), REFERENCE)).toBe('refused');
  });

  it('lists the lines to fix first', () => {
    const lines = triedText([
      { task: 't-a', said: 'Its height', verdict: 'value' },
      {
        task: 't-b',
        said: 'The dots',
        verdict: 'theirs-missing',
        why: '✗ No element .dots on https://www.example.com/'
      }
    ]);

    expect(lines[0]).toContain('t-b: The dots — the other site has no element it reads');
    expect(lines[1]).toContain('t-a: Its height — fails for its value');
  });
});

// A run's lead looped over a first plan's checks by hand before opening: --lines refused with no run open.
describe('a first plan’s lines, tried on the project as it is', () => {
  it('runs each line in the project and says what it is', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-lines-'));
    try {
      // What trying lines reads of a run's context is its project's folder alone.
      const ctx = { root } as unknown as RunContext;
      const tried = await tryLinesOnProject(ctx, {
        tasks: [
          {
            id: 't-a',
            acceptance: [
              { said: 'It holds already', check: 'node -e "process.exit(0)"' },
              { said: 'It is the work', check: 'node -e "process.exit(1)"' }
            ]
          }
        ]
      });

      expect(tried.map(each => [each.task, each.said, each.verdict])).toEqual([
        ['t-a', 'It holds already', 'passes'],
        ['t-a', 'It is the work', 'value']
      ]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
