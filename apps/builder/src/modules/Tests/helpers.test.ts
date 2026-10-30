import { describe, expect, it } from 'vitest';

import {
  STEP_KINDS,
  UNIT_KINDS,
  emptyOf,
  momentsOf,
  moved,
  nextId,
  valueOf,
  valueText,
  withE2eTest,
  withUnitTest
} from './helpers';

import type { E2eStep, SpaceTests, UnitTest } from '@plitzi/sdk-shared';

const shows: UnitTest = { id: 'unit-1', title: 'Shows', element: 'hello', expect: [{ kind: 'visible', value: true }] };

describe('the space’s tests as the builder edits them', () => {
  it('saves the list whole: a test added, replaced under its id, or removed — the other kind untouched', () => {
    const tests: SpaceTests = { unit: [shows], e2e: [{ id: 'e2e-1', title: 'Opens', page: '/', steps: [] }] };
    const hidden = { ...shows, title: 'Hidden', expect: [{ kind: 'visible' as const, value: false }] };

    expect(withUnitTest(tests, hidden, 'unit-1').unit).toEqual([hidden]);
    expect(withUnitTest(tests, { ...shows, id: 'unit-2' }, 'unit-2').unit).toHaveLength(2);
    expect(withUnitTest(tests, undefined, 'unit-1')).toEqual({ unit: [], e2e: tests.e2e });
    expect(withE2eTest(tests, undefined, 'e2e-1')).toEqual({ unit: [shows], e2e: [] });
  });

  it('names a new test with an id the list has not, and starts a row of a kind with its fields', () => {
    expect(nextId('unit', [shows])).toBe('unit-2');
    expect(nextId('unit', [{ id: 'unit-2' }])).toBe('unit-3');
    expect(emptyOf('type', STEP_KINDS.type, 'search')).toEqual({ kind: 'type', element: 'search', text: '' });
    expect(emptyOf('attribute', UNIT_KINDS.attribute, 'x')).toEqual({ kind: 'attribute', name: '', value: true });
  });

  it('reads a value as JSON when it is, and keeps words as words', () => {
    expect([valueOf('3'), valueOf('false'), valueOf('{"a":1}'), valueOf('Hello')]).toEqual([
      3,
      false,
      { a: 1 },
      'Hello'
    ]);
    expect([valueText('Hello'), valueText(3), valueText(undefined)]).toEqual(['Hello', '3', '']);
  });

  it('moves a row up or down, and leaves the list as it was past either end', () => {
    expect(moved(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moved(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
  });
});

const shown = (element: string): E2eStep => ({ kind: 'expectShown', element });
const click = (element: string): E2eStep => ({ kind: 'click', element });

describe('a flow read as moments', () => {
  it('is each thing done with the checks after it, the page as it opens first when it is checked', () => {
    const moments = momentsOf([shown('empty'), click('add'), shown('count'), shown('summary'), click('clear')]);

    expect(moments.map(moment => [moment.action?.index, moment.checks.map(check => check.index)])).toEqual([
      [undefined, [0]],
      [1, [2, 3]],
      [4, []]
    ]);
  });

  it('starts at the first thing done when nothing is checked before it', () => {
    expect(momentsOf([click('add'), shown('count')]).map(moment => moment.action?.index)).toEqual([0]);
  });
});
