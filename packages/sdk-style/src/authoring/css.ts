import { isCssProperty, isCustomProperty, suggestCssProperty } from './properties';
import { expandShorthand } from './shorthand';

import type { CssProps, CssSpec, ResponsiveStyle, StyleRules } from './types';
import type { DisplayMode } from '@plitzi/sdk-shared';

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

/** The breakpoints a rule set can be written for, widest first — the order they cascade in. */
export const BREAKPOINTS: DisplayMode[] = ['desktop', 'tablet', 'mobile'];

const BREAKPOINT_SET = new Set<string>(BREAKPOINTS);

/**
 * The same door as {@link css}, for the shape that carries more than one breakpoint.
 *
 * A rule set whose keys are all breakpoint names is per-breakpoint; anything else is the desktop rules. Every
 * branch ends in {@link css}, so shorthands expand and an unwritable property is refused here either way.
 */
export const toResponsive = (spec: CssSpec | undefined): ResponsiveStyle => {
  if (!spec) {
    return {};
  }

  const keys = Object.keys(spec);
  if (keys.length === 0) {
    return {};
  }

  if (keys.every(key => BREAKPOINT_SET.has(key))) {
    return Object.fromEntries(
      Object.entries(spec as Record<string, Record<string, string | number>>).map(([breakpoint, rules]) => [
        breakpoint,
        css(rules)
      ])
    );
  }

  return { desktop: css(spec as Record<string, string | number>) };
};

const fingerprint = (responsive: ResponsiveStyle): string =>
  JSON.stringify(
    Object.entries(responsive)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([breakpoint, rules]) => [breakpoint, Object.entries(rules).sort(([a], [b]) => a.localeCompare(b))])
  );

/** Whether two normalised rule sets say the same thing, whatever order they were written in. */
export const sameRules = (a: ResponsiveStyle, b: ResponsiveStyle): boolean => fingerprint(a) === fingerprint(b);
