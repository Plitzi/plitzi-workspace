import { InvalidArgumentError } from 'commander';

import { PSEUDOS } from './measureValues';

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
export interface Expected {
  property: string;
  value: string;
  at?: '>=' | '<=';
}

/** `--expect property=value` (or `>=`, `<=`), each its own flag: a value holds commas (`matrix(1, 0, 0, 1, 0, 3)`). */
export const expectedOf = (value: string, previous: Expected[] = []): Expected[] => {
  const match = /^([^=<>]+?)\s*(>=|<=|=)([\s\S]*)$/.exec(value);
  const property = match?.[1]?.trim() ?? '';
  const sign = match?.[2];
  const wanted = match?.[3]?.trim() ?? '';
  if (property === '' || !PROPERTY_NAME.test(property)) {
    throw new InvalidArgumentError(
      'takes a CSS property and the value it must compute to — transform=none, after:content="•" — or the least or most a number of it may be, drawn-width>=340px; one a flag'
    );
  }

  if (sign !== '=' && Number.isNaN(Number.parseFloat(wanted))) {
    throw new InvalidArgumentError(`${property}${sign ?? ''}${wanted}: >= and <= hold a number — width>=44px`);
  }

  return [...previous, { property, value: wanted, ...(sign === '>=' || sign === '<=' ? { at: sign } : {}) }];
};

/** Whether `actual` is what an expectation asks: the same value, or a number on the side of it the sign says. */
export const holds = (actual: string, { value, at }: Expected): boolean => {
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
