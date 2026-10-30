import { InvalidArgumentError } from 'commander';

import { EDGES, parseRelation, relationHolds, sidePx } from '@plitzi/sdk-authoring';

import { PSEUDOS, styleOf } from './measureValues';

import type { Reading } from './measure';
import type { Relation } from '@plitzi/sdk-authoring';

/**
 * `page measure --expect`: what an element must compute a property to — the value, or the least or most a number of
 * it may be — read off its flag and held to what was read.
 */

/** A CSS property's name, as `getComputedStyle` takes it: `overflow-x`, `-webkit-line-clamp`, a pseudo's `after:margin-left`. */
export const PROPERTY_NAME = new RegExp(`^(?:(?:${PSEUDOS.join('|')}):)?-?[a-z][a-z0-9-]*$`);

/**
 * One `--expect`: a property, and the value it must compute to — or, with `at`, the least (`>=`) or most (`<=`) a
 * number of it may be: "the globe is at least 340 px across" held as a line, where a run piped `--json` into `jq`.
 */
export interface PropertyExpected {
  property: string;
  value: string;
  at?: '>=' | '<=';
}

/**
 * Where two elements stand to each other, at every width — `activity.bottom + 8 <= legend-area.top` — read and held as
 * an e2e test's `expectPosition` is (`parseRelation`, sdk-authoring): one reading of a relation, whoever writes it.
 */
export type RelationExpected = Relation;

export type Expected = PropertyExpected | RelationExpected;

/** What names an element's edge (`a.bottom`) is written as a relation. */
const NAMES_AN_EDGE = new RegExp(`[\\w-]\\.(?:${EDGES.join('|')})\\b`);

/** A relation written as one, or nothing — refused, saying how one is written, when it names an edge and is none. */
export const relationOf = (value: string): RelationExpected | undefined => {
  if (!NAMES_AN_EDGE.test(value)) {
    return undefined;
  }

  const relation = parseRelation(value);
  if ('problem' in relation) {
    throw new InvalidArgumentError(relation.problem);
  }

  return relation;
};

/** The elements relations name, to be measured with those asked. */
export const relationElements = (expected: readonly Expected[]): string[] =>
  expected
    .flatMap(each => ('said' in each ? [each.left.element, each.right.element] : []))
    .filter((element): element is string => element !== undefined);

/** An expectation as it was written. */
export const expectedText = (each: Expected): string =>
  'said' in each ? each.said : `${each.property}${each.at ?? '='}${each.value}`;

/** `--expect property=value` (or `>=`, `<=`), or a relation of two elements' edges, each its own flag. */
export const expectedOf = (value: string, previous: Expected[] = []): Expected[] => {
  const relation = relationOf(value);
  if (relation) {
    return [...previous, relation];
  }

  const match = /^([^=<>]+?)\s*(>=|<=|=)([\s\S]*)$/.exec(value);
  const property = match?.[1]?.trim() ?? '';
  const sign = match?.[2];
  const wanted = match?.[3]?.trim() ?? '';
  if (property === '' || !PROPERTY_NAME.test(property)) {
    throw new InvalidArgumentError(
      'takes a CSS property and the value it must compute to — transform=none, after:content="•" — or the least or most a number of it may be, drawn-width>=340px — or where two elements stand, "activity.bottom + 8 <= legend-area.top"; one a flag'
    );
  }

  if (sign !== '=' && Number.isNaN(Number.parseFloat(wanted))) {
    throw new InvalidArgumentError(`${property}${sign ?? ''}${wanted}: >= and <= hold a number — width>=44px`);
  }

  return [...previous, { property, value: wanted, ...(sign === '>=' || sign === '<=' ? { at: sign } : {}) }];
};

/** Whether `actual` is what an expectation asks: the same value, or a number on the side of it the sign says. */
export const holds = (actual: string, { value, at }: PropertyExpected): boolean => {
  if (at === undefined) {
    return valueText(actual) === valueText(value);
  }

  const [have, want] = [Number.parseFloat(actual), Number.parseFloat(value)];

  return !Number.isNaN(have) && (at === '>=' ? have >= want : have <= want);
};

/** A computed value as compared: its spaces as one, so `matrix(1,0,…)` and `matrix(1, 0, …)` read alike. */
const valueText = (value: string): string =>
  value
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Each element read whose property is not the value expected, and each relation that does not hold at a width: a line
 * each, said where the command fails.
 */
export const expectationsMissed = (readings: readonly Reading[], expected: readonly Expected[]): string[] => [
  ...readings.flatMap(({ here, pair, width, scheme }) => {
    if ('problem' in here) {
      return [];
    }

    return expected.flatMap(each => {
      if ('said' in each) {
        return [];
      }

      const { property, value, at } = each;
      const actual = styleOf(here.styles, property);

      return actual !== undefined && holds(actual, each)
        ? []
        : [
            `--expect ${property}${at ?? '='}${value}: ${pair.here} at ${String(width)} px${scheme ? ` ${scheme}` : ''} ${actual === undefined ? 'has none read' : `is ${actual}`}`
          ];
    });
  }),
  ...relationsMissed(readings, expected)
];

/** Each relation that does not hold at a view: what each side read, and by how much it misses. */
const relationsMissed = (readings: readonly Reading[], expected: readonly Expected[]): string[] => {
  const views = [...new Set(readings.map(reading => `${String(reading.width)}|${reading.scheme ?? ''}`))];

  return views.flatMap(view => {
    const here = readings.filter(reading => `${String(reading.width)}|${reading.scheme ?? ''}` === view);
    const [{ width, scheme }] = here;
    const boxOf = (element: string) => {
      const read = here.find(reading => reading.pair.here === element)?.here;

      return read === undefined || 'problem' in read || read.hidden !== undefined ? undefined : read.box;
    };

    return expected.flatMap(each => {
      if (!('said' in each)) {
        return [];
      }

      const [left, right] = [sidePx(each.left, boxOf), sidePx(each.right, boxOf)];
      const at = `at ${String(width)} px${scheme ? ` ${scheme}` : ''}`;
      if (typeof left !== 'number' || typeof right !== 'number') {
        const missing = typeof left === 'number' ? (typeof right === 'number' ? '' : right.missing) : left.missing;

        return [`--expect "${each.said}": ${missing} ${at} has no box read — not drawn there, or hidden`];
      }

      return relationHolds(left, each.at, right)
        ? []
        : [
            `--expect "${each.said}": ${at} ${String(Math.round(left * 10) / 10)} ${each.at} ${String(Math.round(right * 10) / 10)} does not hold — ${String(Math.round(Math.abs(left - right) * 10) / 10)} px apart`
          ];
    });
  });
};
