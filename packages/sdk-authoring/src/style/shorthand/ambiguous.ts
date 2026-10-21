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

/** Every shorthand of `rules` a bare `var()` makes ambiguous, with the longhand to write instead. */
export const ambiguousShorthands = (rules: CssProps): AmbiguousShorthand[] =>
  Object.entries(rules).flatMap(([property, value]) => {
    if (property !== 'background' || typeof value !== 'string') {
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
