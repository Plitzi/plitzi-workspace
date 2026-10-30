import { describe, expect, it } from 'vitest';

import { expectationsMissed, expectedOf, relationElements } from './measureExpected';
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

  // A run's designer and tester held a globe's drawn size — at least 340 px across — with a PNG decoder of their own.
  it('holds a number at least or at most one, and refuses a sign beside no number', () => {
    expect(expectedOf('drawn-width>=340px')).toEqual([{ property: 'drawn-width', value: '340px', at: '>=' }]);
    expect(expectedOf('height<=44px')).toEqual([{ property: 'height', value: '44px', at: '<=' }]);
    expect(() => expectedOf('width>=wide')).toThrow('width>=wide: >= and <= hold a number — width>=44px');

    const drawn = (width: string) => ({
      ...reading(undefined),
      here: { ...reading(undefined).here, styles: { 'drawn-width': width } }
    });
    const atLeast = [{ property: 'drawn-width', value: '340px', at: '>=' as const }];
    expect(expectationsMissed([drawn('348px')], atLeast)).toEqual([]);
    expect(expectationsMissed([drawn('322px')], atLeast)).toEqual([
      '--expect drawn-width>=340px: site-sign-in at 390 px is 322px'
    ]);
    expect(expectationsMissed([drawn('none')], atLeast)).toEqual([
      '--expect drawn-width>=340px: site-sign-in at 390 px is none'
    ]);
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

// A run's layout lines — one row, clear of the corner, above the legend — were each ~300 characters of jq over --json.
describe('page measure --expect, two elements', () => {
  const at = (id: string, box: { x: number; y: number; width: number; height: number }, width = 1440) => ({
    width,
    pair: { here: id, there: id },
    here: { selector: `[data-plitzi-el="${id}"]`, tag: 'div', text: '', box, styles: {}, inherited: [] },
    unlike: []
  });
  const relation = expectedOf('activity.bottom + 8 <= legend-area.top');

  it('reads a relation of edges, give or take px, and the elements it names', () => {
    expect(relation).toEqual([
      {
        said: 'activity.bottom + 8 <= legend-area.top',
        left: { element: 'activity', edge: 'bottom', px: 8 },
        at: '<=',
        right: { element: 'legend-area', edge: 'top', px: 0 }
      }
    ]);
    expect(relationElements(relation)).toEqual(['activity', 'legend-area']);
    expect(expectedOf('filters.width >= 300px')).toEqual([
      {
        said: 'filters.width >= 300px',
        left: { element: 'filters', edge: 'width', px: 0 },
        at: '>=',
        right: { px: 300 }
      }
    ]);
    expect(() => expectedOf('activity.bottom <= legend')).toThrow(/is no relation: two sides/);
  });

  it('holds at every width, and says by how much one misses', () => {
    const fits = [
      at('activity', { x: 22, y: 483, width: 300, height: 132 }),
      at('legend-area', { x: 22, y: 627, width: 300, height: 253 })
    ];
    expect(expectationsMissed(fits, relation)).toEqual([]);

    const past = [
      ...fits.map(each => ({ ...each, width: 390 })),
      at('activity', { x: 22, y: 500, width: 300, height: 135 }),
      at('legend-area', { x: 22, y: 627, width: 300, height: 253 })
    ];
    expect(expectationsMissed(past, relation)).toEqual([
      '--expect "activity.bottom + 8 <= legend-area.top": at 1440 px 643 <= 627 does not hold — 16 px apart'
    ]);
    expect(expectationsMissed([fits[0]], relation)).toEqual([
      '--expect "activity.bottom + 8 <= legend-area.top": legend-area at 1440 px has no box read — not drawn there, or hidden'
    ]);
  });
});
