import { isCssProperty, isCustomProperty, suggestCssProperty } from './properties';
import { expandShorthand } from './shorthand';

import type { CssProps, StyleRules } from './types';

/**
 * The one door CSS goes through while authoring.
 *
 * It does two things a hand-written object cannot: it expands the shorthands the style editor has no controls for,
 * and it refuses a property that is not in the vocabulary. Both failures are silent otherwise — a shorthand renders
 * and then cannot be edited, a typo renders as nothing at all — and both are cheapest to hear about on the line
 * that wrote them.
 *
 * Idempotent: rules that are already longhand pass through unchanged, so a fragment may be run through it twice.
 */
export const css = (rules: CssProps): StyleRules => {
  const expanded = expandShorthand(rules);
  const unknown = Object.keys(expanded).filter(key => !isCssProperty(key) && !isCustomProperty(key));

  if (unknown.length > 0) {
    throw new Error(
      `Unknown CSS ${unknown.length === 1 ? 'property' : 'properties'}: ${unknown
        .map(key => {
          const suggestion = suggestCssProperty(key);

          return suggestion ? `"${key}" (did you mean "${suggestion}"?)` : `"${key}"`;
        })
        .join(', ')}. Plitzi's style vocabulary is a closed list of kebab-case properties.`
    );
  }

  return expanded;
};
