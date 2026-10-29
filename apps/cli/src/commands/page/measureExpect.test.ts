import { describe, expect, it } from 'vitest';

import { expectationsMissed, expectedOf } from './measure';
import { MEASURED } from './measureValues';

// An acceptance line holding one page's value — a key latched: transform — piped page measure's --json into node -e.
describe('page measure --expect', () => {
  const reading = (transform: string | undefined) => ({
    width: 390,
    pair: { here: 'site-sign-in', there: 'site-sign-in' },
    here: {
      selector: '[data-plitzi-el="site-sign-in"]',
      tag: 'a',
      text: 'Sign in',
      box: { x: 0, y: 0, width: 0, height: 0 },
      styles: Object.fromEntries(transform === undefined ? [] : [['transform', transform]]),
      inherited: []
    },
    unlike: []
  });

  it('reads a property and the value it must compute to — commas in it, one a flag', () => {
    expect(expectedOf('transform=matrix(1, 0, 0, 1, 0, 3)')).toEqual([
      { property: 'transform', value: 'matrix(1, 0, 0, 1, 0, 3)' }
    ]);
    expect(expectedOf('color=red', [{ property: 'transform', value: 'none' }])).toHaveLength(2);
    expect(() => expectedOf('latched')).toThrow(/takes a CSS property and the value/);
  });

  it('says each element read whose value is another — spaces as one — and none that holds it', () => {
    const expected = [{ property: 'transform', value: 'matrix(1,0,0,1,0,3)' }];

    expect(expectationsMissed([reading('matrix(1, 0, 0, 1, 0, 3)')], expected)).toEqual([]);
    expect(expectationsMissed([reading('none')], expected)).toEqual([
      '--expect transform=matrix(1,0,0,1,0,3): site-sign-in at 390 px is none'
    ]);
    expect(expectationsMissed([reading(undefined)], expected)).toEqual([
      '--expect transform=matrix(1,0,0,1,0,3): site-sign-in at 390 px has none read'
    ]);
  });
});

// A long name on a key wrapped: proving it took a script of an agent's own, measure saying neither.
describe('what measure reads of words', () => {
  it('reads whether they wrap and where a long one breaks', () => {
    expect(MEASURED).toEqual(expect.arrayContaining(['white-space', 'overflow-wrap']));
  });
});

// A dialog drawn under the site's sticky bar: which of two layers is on top could not be read nor held by --expect.
describe('what measure reads of layers', () => {
  it('reads a box’s z-index beside its position', () => {
    expect(MEASURED).toEqual(expect.arrayContaining(['position', 'z-index']));
  });
});
