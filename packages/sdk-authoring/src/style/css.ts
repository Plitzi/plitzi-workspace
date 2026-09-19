import { STYLE_STATES as SHARED_STYLE_STATES } from '@plitzi/sdk-shared/style/styleStates';

import { isCssProperty, isCustomProperty, suggestCssProperty } from './properties';
import { expandShorthand } from './shorthand';

import type {
  CssProps,
  CssSpec,
  ResponsiveBlock,
  ResponsiveStyle,
  RuleSetSpec,
  StatesSpec,
  StyleRules,
  StyleSpec
} from './types';
import type {
  DisplayMode,
  StyleAncestors,
  StyleBlock,
  StyleState,
  StyleStates,
  StyleVariants
} from '@plitzi/sdk-shared';

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

/** The states a selector can react to — the closed list the style editor offers, read from where it is declared. */
export const STYLE_STATES: readonly StyleState[] = SHARED_STYLE_STATES;

const STYLE_STATE_SET = new Set<string>(STYLE_STATES);

const RULE_SET_KEYS = new Set(['css', 'states', 'variants', 'ancestors']);

/**
 * Whether a style is the object form rather than plain CSS.
 *
 * Told apart by the keys, like the per-breakpoint shape: `css`, `states`, `variants` and `ancestors` are not CSS properties, so
 * an object naming only those is a rule set and anything else is CSS.
 */
export const isRuleSetSpec = (spec: StyleSpec): spec is RuleSetSpec => {
  const keys = Object.keys(spec);

  return keys.length > 0 && keys.every(key => RULE_SET_KEYS.has(key));
};

const toStates = (states: StatesSpec | undefined): Map<string, ResponsiveStyle> => {
  const unknown = Object.keys(states ?? {}).filter(state => !STYLE_STATE_SET.has(state));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown style state ${unknown.map(state => `"${state}"`).join(', ')}. A selector reacts to ${STYLE_STATES.join(', ')}.`
    );
  }

  return new Map(Object.entries(states ?? {}).map(([state, rules]) => [state, toResponsive(rules)]));
};

const CLASS_NAME = /^-?[_a-zA-Z][\w-]*$/;

const toAncestors = (ancestors: RuleSetSpec['ancestors']) =>
  Object.entries(ancestors ?? {}).map(([name, ancestor]) => {
    if (!CLASS_NAME.test(name)) {
      throw new Error(
        `The ancestor "${name}" is not a class name. An ancestor condition is keyed by a class that ancestor wears — \`[card.name]\` for a \`styles()\` declaration.`
      );
    }

    return [name, toBlocks({ css: ancestor.css, states: ancestor.states, variants: ancestor.variants })] as const;
  });

const statesAt = (states: Map<string, ResponsiveStyle>, breakpoint: DisplayMode): StyleStates | undefined => {
  const entries = [...states].flatMap(([state, responsive]) => {
    const rules = responsive[breakpoint];

    return rules && Object.keys(rules).length > 0 ? [[state, rules] as const] : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/**
 * The same door as {@link css}, for everything one selector carries: its rules, its states and its variants.
 *
 * Every rule set in it goes through {@link css}, so a shorthand in a `hover` expands and a typo in a variant is
 * refused on the line that wrote it. A breakpoint nothing speaks for is left out, which is what the builder writes.
 */
export const toBlocks = (spec: StyleSpec | undefined): ResponsiveBlock => {
  if (!spec) {
    return {};
  }

  const ruleSet: RuleSetSpec = isRuleSetSpec(spec) ? spec : { css: spec };
  const base = toResponsive(ruleSet.css);
  const states = toStates(ruleSet.states);
  const variants = Object.entries(ruleSet.variants ?? {}).map(([name, variant]) => [name, toBlocks(variant)] as const);
  const ancestors = toAncestors(ruleSet.ancestors);

  const blocks: ResponsiveBlock = {};
  for (const breakpoint of BREAKPOINTS) {
    const rules = base[breakpoint] ?? {};
    const stateRules = statesAt(states, breakpoint);
    const variantRules: StyleVariants = Object.fromEntries(
      variants.flatMap(([name, variantBlocks]) => {
        const block = variantBlocks[breakpoint];

        return block
          ? [[name, { default: block.default ?? {}, ...(block.states ? { states: block.states } : {}) }]]
          : [];
      })
    );

    const ancestorRules: StyleAncestors = Object.fromEntries(
      ancestors.flatMap(([name, ancestorBlocks]) => {
        const { default: rules = {}, states, variants } = ancestorBlocks[breakpoint] ?? {};
        const inside = Object.keys(rules).length > 0;

        return inside || states || variants
          ? [
              [
                name,
                {
                  ...(inside ? { default: rules } : {}),
                  ...(states ? { states } : {}),
                  ...(variants ? { variants } : {})
                }
              ]
            ]
          : [];
      })
    );

    if (
      Object.keys(rules).length === 0 &&
      !stateRules &&
      Object.keys(variantRules).length === 0 &&
      Object.keys(ancestorRules).length === 0
    ) {
      continue;
    }

    const block: StyleBlock = {
      default: rules,
      ...(stateRules ? { states: stateRules } : {}),
      ...(Object.keys(variantRules).length > 0 ? { variants: variantRules } : {}),
      ...(Object.keys(ancestorRules).length > 0 ? { ancestors: ancestorRules } : {})
    };
    blocks[breakpoint] = block;
  }

  return blocks;
};

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, inner]) => [key, canonical(inner)]);
  }

  return value;
};

/** Whether two normalised selectors say the same thing, whatever order they were written in. */
export const sameBlocks = (a: ResponsiveBlock, b: ResponsiveBlock): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
