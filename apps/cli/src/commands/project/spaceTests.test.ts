import { describe, expect, it } from 'vitest';

import { spaceTestsText, testsChosen } from './spaceTests';

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

describe('the tests a run takes', () => {
  const tests = {
    unit: [{ id: 'badge', title: 'Badge', element: 'count', expect: [] }],
    e2e: [
      { id: 'signs-in', title: 'Signs in', page: '/', tags: ['sign-in'], steps: [] },
      { id: 'phone', title: 'Phone', page: '/', tags: ['sign-in', 'phone'], steps: [] },
      { id: 'orders', title: 'Orders', page: '/menu', steps: [] }
    ]
  };
  const ids = (chosen: ReturnType<typeof testsChosen>) => ({
    unit: chosen.unit.map(test => test.id),
    e2e: chosen.e2e.map(test => test.id),
    unknown: chosen.unknown
  });

  it('takes every test, or those named, of the kind asked', () => {
    expect(ids(testsChosen(tests, [], {}))).toEqual({
      unit: ['badge'],
      e2e: ['signs-in', 'phone', 'orders'],
      unknown: []
    });
    expect(ids(testsChosen(tests, ['orders', 'nope'], { e2e: true }))).toEqual({
      unit: [],
      e2e: ['orders'],
      unknown: ['no test of the space is "nope"']
    });
  });

  // --tag: a part of a long list — the journeys carrying one of its tags, and no unit test, which has none.
  it('takes with --tag the journeys carrying one of its tags, and says a tag no journey carries', () => {
    expect(ids(testsChosen(tests, [], { tag: 'phone' }))).toEqual({ unit: [], e2e: ['phone'], unknown: [] });
    expect(ids(testsChosen(tests, [], { tag: 'sign-in, checkout' }))).toEqual({
      unit: [],
      e2e: ['signs-in', 'phone'],
      unknown: ['no journey of the space is tagged "checkout"']
    });
    expect(ids(testsChosen(tests, ['orders'], { tag: 'sign-in' }))).toEqual({
      unit: [],
      e2e: [],
      unknown: ['the journey "orders" carries none of the tags asked: sign-in']
    });
  });
});
