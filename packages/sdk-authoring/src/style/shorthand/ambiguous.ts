import { splitOn, splitPair, splitTokens } from './helpers';

import type { CssProps } from '../types';

/**
 * A shorthand whose longhands cannot be told from its value: one of its parts is a bare `var(--x)`, and what the
 * variable holds — a colour, a gradient, a picture — decides which longhand it is. Expanded, it was guessed: a
 * `background: var(--x)` holding a gradient became a `background-color` that paints nothing. Refused instead, saying
 * the longhand to write.
 */
export interface AmbiguousShorthand {
  property: string;
  value: string;
  /** What to write instead: each longhand it may be, and when — said after "Name the longhand it is:". */
  fix: string;
}

/** A part that is a custom property and nothing else: what it holds is the variable's, unknown here. */
const isBareVar = (token: string): boolean => /^var\(\s*--[\w-]+\s*(,.*)?\)$/s.test(token);

/** The parts of a background layer, the `position / size` of its slash split apart. */
const backgroundParts = (layer: string): string[] => {
  const [before, after] = splitPair(layer, '/');

  return [...splitTokens(before), ...(after === undefined ? [] : splitTokens(after))];
};

/** The shorthands of a box's sides, each written to its four longhands from one to four values. */
const BOX_SIDES: Readonly<Record<string, readonly [string, string, string, string]>> = {
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left']
};

/**
 * A box's shorthand whose one value is a `var()` falling back to several — `var(--pad, 4px 10px)`: expanded, each side
 * got the whole of it, and with the variable unset every side was `4px 10px`, no length at all (a run's ON AIR plate).
 */
const sidesOfOneVar = (property: string, value: string): AmbiguousShorthand | undefined => {
  const sides = Object.hasOwn(BOX_SIDES, property) ? BOX_SIDES[property] : undefined;
  const tokens = splitTokens(value);
  const fallback = /^var\(\s*--[\w-]+\s*,(.*)\)$/s.exec(tokens[0] ?? '')?.[1];
  if (sides === undefined || tokens.length !== 1 || fallback === undefined || splitTokens(fallback.trim()).length < 2) {
    return undefined;
  }

  return {
    property,
    value,
    fix: `each side its own variable — ${sides.map(side => `'${side}': 'var(--${side}, …)'`).join(', ')} — or the shorthand with one var() a side: '${property}': 'var(--y, 4px) var(--x, 10px)'`
  };
};

/** Every shorthand of `rules` a bare `var()` makes ambiguous, with the longhand to write instead. */
export const ambiguousShorthands = (rules: CssProps): AmbiguousShorthand[] =>
  Object.entries(rules).flatMap(([property, value]) => {
    if (typeof value !== 'string') {
      return [];
    }

    const sides = sidesOfOneVar(property, value);
    if (sides) {
      return [sides];
    }

    if (property !== 'background') {
      return [];
    }

    const bare = splitOn(value, ',').flatMap(backgroundParts).find(isBareVar);

    return bare === undefined
      ? []
      : [
          {
            property,
            value,
            fix: `'background-color': '${bare}' for a colour, 'background-image': '${bare}' for a gradient or a picture — a var() inside one (linear-gradient(…, ${bare})) is read as it is`
          }
        ];
  });
