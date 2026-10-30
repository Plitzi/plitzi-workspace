import { describe, expect, it } from 'vitest';

import { spaceTestsText } from './spaceTests';

describe('the project’s tests, as plitzi test and plitzi verify say them', () => {
  it('says the tests written wrong first, and nothing run', () => {
    expect(spaceTestsText({ ok: false, problems: ['no test of the space is "nope"'], count: 1, e2e: [] })).toEqual([
      '✗ no test of the space is "nope"'
    ]);
  });

  it('says a space with no tests, and how to write one', () => {
    expect(spaceTestsText({ ok: true, problems: [], count: 0, e2e: [] })).toEqual([
      '✗ the space has no tests — write them in its spec: tests: { unit: [unit.test(…)], e2e: [e2e.test(…)] }'
    ]);
  });

  it('says each kind with what each test did, and the flows counted', () => {
    const lines = spaceTestsText({
      ok: false,
      problems: [],
      count: 2,
      e2e: [
        { id: 'buys', title: 'A visitor buys', ok: true, ms: 1200, steps: [{ said: 'click buy', ok: true, ms: 300 }] },
        {
          id: 'lost',
          title: 'A wrong address',
          ok: false,
          ms: 800,
          steps: [{ said: 'lost-title shown', ok: false, read: 'it is not on the page', ms: 800 }]
        }
      ]
    });

    expect(lines).toEqual([
      'E2E tests',
      '✓ buys — A visitor buys (1.2 s)',
      '  ✓ click buy',
      '✗ lost — A wrong address (0.8 s)',
      '  ✗ lost-title shown — it is not on the page',
      '1 passed, 1 failed'
    ]);
  });
});
