import { describe, expect, it } from 'vitest';

import { triedText, verdictOf } from './tryLines';

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
