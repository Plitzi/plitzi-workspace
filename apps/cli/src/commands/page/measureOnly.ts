import { InvalidArgumentError } from 'commander';

import { ACCESSIBLE_NAME, METRICS } from './measureAsked';
import { PROPERTY_NAME } from './measureExpected';
import { DRAWN } from './measureValues';

/** What `page measure --only` prints and `--same` holds: the properties by name, and the shorthands of them. */

/** Shorthands `--same` takes for the properties they stand for: a border is its four sides, a type its six. */
const GROUPS: Record<string, readonly string[]> = {
  border: ['border-top', 'border-right', 'border-bottom', 'border-left'],
  font: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform'],
  size: ['width', 'height'],
  // Where it is and how big, its spacing with it: what a fit is checked by — a run's agents grepped it out of 30.
  box: ['x', 'y', 'width', 'height', 'box-width', 'box-height', 'padding', 'margin'],
  // What it draws, off its picture: a canvas's globe, a chart's plot (`DRAWN`).
  drawn: [...DRAWN]
};

/**
 * `--same`'s and `--only`'s list: each a property always measured, a pseudo-element's (`before:background-image`), a
 * shorthand of them — or any other CSS property by its name, read as well (`overflow-x`, `after:scroll-snap-align`):
 * whether the browser knows it is asked of the browser, once, before anything is read (`unknownProperties`).
 */
const measuredProperties =
  (flag: string) =>
  (value: string): string[] => {
    const asked = value
      .split(',')
      .map(each => each.trim())
      .filter(Boolean);
    const unknown = asked.filter(
      each =>
        !Object.hasOwn(GROUPS, each) &&
        !PROPERTY_NAME.test(each) &&
        each !== ACCESSIBLE_NAME &&
        !(METRICS as readonly string[]).includes(each)
    );
    if (unknown.length > 0 || asked.length === 0) {
      throw new InvalidArgumentError(
        `${flag} takes CSS properties by name, comma-separated — any the browser knows (overflow-x, scroll-snap-type), a pseudo-element's as before:<property> or after:<property>, a custom property after = (${flag}=--vz-accent), an attribute as attr:<name> (attr:role, attr:aria-label), accessible-name, ${METRICS.join(', ')} — or ${Object.keys(GROUPS).join(', ')}${unknown.length > 0 ? `: not ${unknown.join(', ')}` : ''}`
      );
    }

    return [...new Set(asked.flatMap(each => GROUPS[each] ?? [each]))];
  };

/** `--same`'s list: what must be as the other page's. */
export const sameProperties = measuredProperties('--same');

/** `--only`'s list: what is printed of each element — a fit asks for its box, not thirty properties. */
export const onlyProperties = measuredProperties('--only');
