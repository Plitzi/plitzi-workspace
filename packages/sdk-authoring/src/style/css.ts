import { canonicalCondition, STYLE_MOTION_CONDITIONS } from '@plitzi/sdk-shared/style/styleConditions';
import {
  CONTENT_PSEUDOS,
  GENERATED_PSEUDOS,
  isContentValue,
  isStylePseudo,
  PSEUDO_PROPERTIES,
  pseudoHonours,
  STYLE_PSEUDOS
} from '@plitzi/sdk-shared/style/stylePseudos';
import { isParentAncestor, STYLE_STATES as SHARED_STYLE_STATES } from '@plitzi/sdk-shared/style/styleStates';

import { cssNumberValue, cssPropertyName, isCssProperty, isCustomProperty, suggestCssProperty } from './properties';
import { expandShorthandTraced } from './shorthand';
import { overlaid, recordShorthands } from './shorthandOrigins';
import { AuthoringError } from '../schema/codes';
import { didYouMean } from '../schema/suggest';

import type {
  ConditionRulesSpec,
  ConditionSpec,
  CssInput,
  CssProps,
  CssSpec,
  PseudoRulesSpec,
  PseudoSpec,
  PseudosSpec,
  ResponsiveBlock,
  ResponsiveCss,
  ResponsiveStyle,
  ResponsiveValue,
  RuleSetSpec,
  StatesSpec,
  StyleRules,
  StyleSpec
} from './types';
import type {
  DisplayMode,
  StyleAncestors,
  StyleBlock,
  StyleConditions,
  StylePseudo,
  StylePseudos,
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
/**
 * Whether a value would end its declaration early — a `;` or a brace outside quotes and `url(…)` turns the rest of the
 * text into rules of its own, or into nothing. Quoted text and a data URL may carry them legitimately.
 */
const breaksDeclaration = (value: string): boolean =>
  /[;{}]/.test(value.replace(/url\([^)]*\)/gi, '').replace(/"[^"]*"|'[^']*'/g, ''));

/** Refuses a value that is not one CSS value: empty, not text or a number, or one that breaks out of its declaration. */
const assertValues = (rules: CssProps): void => {
  for (const [property, value] of Object.entries(rules)) {
    const text = typeof value === 'number' ? String(value) : value;
    if (typeof text !== 'string' || text.trim() === '' || breaksDeclaration(text)) {
      throw new AuthoringError(
        'css-value',
        `\`${property}: ${String(value)}\` is not one CSS value. Write a single value — \`'${property}': '…'\` — and one property per key; leave a property out rather than writing it empty.`
      );
    }
  }
};

/**
 * The rules in the spelling the document keeps: camelCase keys in kebab-case, and a bare number on a length in pixels.
 * Two keys that are one property — `paddingTop` beside `'padding-top'` — would have one silently win, so they are refused.
 */
const normalise = (rules: CssProps): CssProps => {
  const normalised: CssProps = {};
  for (const [key, value] of Object.entries(rules)) {
    const property = cssPropertyName(key);
    if (Object.hasOwn(normalised, property)) {
      throw new AuthoringError(
        'css-property-twice',
        `\`${property}\` is written twice in one rule set${key === property ? '' : ` (once as \`${key}\`)`}: keep one.`
      );
    }

    normalised[property] = typeof value === 'number' ? cssNumberValue(property, value) : value;
  }

  return normalised;
};

export const css = (input: CssProps): StyleRules => {
  const rules = normalise(input);
  assertValues(rules);
  const { rules: expanded, from } = expandShorthandTraced(rules);
  recordShorthands(expanded, from);
  const unknown = Object.keys(expanded).filter(key => !isCssProperty(key) && !isCustomProperty(key));

  if (unknown.length > 0) {
    throw new AuthoringError(
      'css-property-unknown',
      `Unknown CSS ${unknown.length === 1 ? 'property' : 'properties'}: ${unknown
        .map(key => {
          const suggestion = suggestCssProperty(key);

          return suggestion ? `"${key}" (did you mean "${suggestion}"?)` : `"${key}"`;
        })
        .join(
          ', '
        )}. Plitzi's style vocabulary is a closed list of kebab-case properties — a shorthand is expanded into them. One that is standard CSS and not a typo is not in it yet: write it in the space's \`customCss\`, under the element's class, until it is.`
    );
  }

  return expanded;
};

/** The breakpoints a rule set can be written for, widest first — the order they cascade in. */
export const BREAKPOINTS: DisplayMode[] = ['desktop', 'tablet', 'mobile'];

/** The keys a per-breakpoint rule set may use: the breakpoints, and `compact` for tablet and mobile together. */
const BREAKPOINT_SET = new Set<string>([...BREAKPOINTS, 'compact']);

const isDisplayMode = (key: string): key is DisplayMode => BREAKPOINTS.some(breakpoint => breakpoint === key);

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
    // Every key is a breakpoint name, which is what makes this the per-breakpoint half of the union; TS cannot narrow
    // a union by the names of its keys.
    const { compact, ...byBreakpoint } = spec as ResponsiveCss;
    const responsive: ResponsiveStyle = Object.fromEntries(
      Object.entries(byBreakpoint).flatMap(([breakpoint, rules]) =>
        Object.keys(rules).length > 0 ? [[breakpoint, css(rules)]] : []
      )
    );
    if (compact) {
      const shared = css(compact);
      responsive.tablet = overlaid(shared, responsive.tablet);
      responsive.mobile = overlaid(shared, responsive.mobile);
    }

    return responsive;
  }

  return toResponsive(byProperty(spec));
};

const isBreakpointValues = (value: unknown): value is ResponsiveValue =>
  typeof value === 'object' &&
  value !== null &&
  Object.keys(value).length > 0 &&
  Object.keys(value).every(key => BREAKPOINT_SET.has(key));

/**
 * Plain rules where a property may carry a value per breakpoint — \`fontSize: { desktop: '24px', mobile: '18px' }\` —
 * gathered into the per-breakpoint shape, so changing one property on a phone does not split the whole rule set.
 */
const byProperty = (rules: CssInput): ResponsiveCss => {
  const responsive: Partial<Record<DisplayMode | 'compact', CssProps>> = { desktop: {} };
  for (const [property, value] of Object.entries(rules)) {
    if (!isBreakpointValues(value)) {
      responsive.desktop = { ...responsive.desktop, [property]: value };
      continue;
    }

    for (const [breakpoint, breakpointValue] of Object.entries(value)) {
      if (breakpoint === 'compact' || isDisplayMode(breakpoint)) {
        responsive[breakpoint] = { ...responsive[breakpoint], [property]: breakpointValue };
      }
    }
  }

  return responsive;
};

/** The states a selector can react to — the closed list the style editor offers, read from where it is declared. */
export const STYLE_STATES: readonly StyleState[] = SHARED_STYLE_STATES;

const STYLE_STATE_SET = new Set<string>(STYLE_STATES);

const RULE_SET_KEYS = new Set(['css', 'states', 'variants', 'ancestors', 'pseudos', 'conditions']);

/**
 * Whether a style is the object form rather than plain CSS.
 *
 * Told apart by the keys, like the per-breakpoint shape: `css`, `states`, `variants`, `ancestors`, `pseudos` and
 * `conditions` are not CSS properties, so an object naming only those is a rule set and anything else is CSS.
 */
export const isRuleSetSpec = (spec: StyleSpec): spec is RuleSetSpec => {
  const keys = Object.keys(spec);

  return keys.length > 0 && keys.every(key => RULE_SET_KEYS.has(key));
};

const toStates = (states: StatesSpec | undefined): Map<string, ResponsiveStyle> => {
  const unknown = Object.keys(states ?? {}).filter(state => !STYLE_STATE_SET.has(state));
  if (unknown.length > 0) {
    throw new AuthoringError(
      'style-state-unknown',
      `Unknown style state ${unknown.map(state => `"${state}"`).join(', ')}. A selector reacts to ${STYLE_STATES.join(', ')}.`
    );
  }

  return new Map(Object.entries(states ?? {}).map(([state, rules]) => [state, toResponsive(rules)]));
};

const CLASS_NAME = /^-?[_a-zA-Z][\w-]*$/;

const toAncestors = (ancestors: RuleSetSpec['ancestors']) =>
  Object.entries(ancestors ?? {}).map(([name, ancestor]) => {
    if (!isParentAncestor(name) && !CLASS_NAME.test(name)) {
      throw new AuthoringError(
        'ancestor-not-class',
        `The ancestor "${name}" is not a class name. An ancestor condition is keyed by a class that ancestor wears — \`[card.name]\` for a \`styles()\` declaration — or by \`'>'\` for the parent, whatever it wears.`
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

/** A part of a selector that holds rules of its own and the selector's states over them: a pseudo-element, a condition. */
interface PartRules {
  base: ResponsiveStyle;
  states: Map<string, ResponsiveStyle>;
}

/** Every rule set of a part — its own and its states', on every breakpoint — with the state it belongs to. */
const partRuleSets = ({ base, states }: PartRules): StyleRules[] => [
  ...Object.values(base),
  ...[...states.values()].flatMap(responsive => Object.values(responsive))
];

/** The keys of a part's object form, which no CSS property shares. */
const PART_KEYS = new Set(['css', 'states', 'pseudos']);

/** Whether a part is written as `{ css, states, pseudos }` rather than plain CSS — told apart by the keys. */
const isPartSpec = (spec: PseudoSpec | ConditionSpec): spec is PseudoRulesSpec | ConditionRulesSpec => {
  const keys = Object.keys(spec);

  return keys.length > 0 && keys.every(key => PART_KEYS.has(key));
};

const partOf = (spec: PseudoSpec | ConditionSpec): ConditionRulesSpec => (isPartSpec(spec) ? spec : { css: spec });

/**
 * Refuses what a pseudo-element would not draw: a property the browser drops there, a `content` CSS cannot read (text
 * without its quotes), `content` where it draws nothing, and a `before`/`after` with no `content` at all — which is
 * not there, however it is styled.
 */
const assertPseudo = (pseudo: StylePseudo, part: PartRules): void => {
  const ruleSets = partRuleSets(part);
  for (const rules of ruleSets) {
    for (const [property, value] of Object.entries(rules)) {
      if (property === 'content') {
        if (!CONTENT_PSEUDOS.includes(pseudo)) {
          throw new AuthoringError(
            'style-pseudo-content',
            `\`content\` on \`::${pseudo}\` draws nothing: only ${CONTENT_PSEUDOS.map(name => `\`::${name}\``).join(', ')} take one.`
          );
        }

        if (!isContentValue(String(value))) {
          throw new AuthoringError(
            'style-pseudo-content',
            `\`content: ${String(value)}\` on \`::${pseudo}\` is not text CSS can read, so nothing is drawn. Text goes in quotes inside the string — \`content: '"${String(value).replace(/"/g, '\\"')}"'\` — and an empty box is \`'""'\`; \`counter()\`, \`attr()\` and \`url()\` are written as they are.`
          );
        }

        continue;
      }

      if (!pseudoHonours(pseudo, property)) {
        throw new AuthoringError(
          'style-pseudo-property',
          `\`${property}\` on \`::${pseudo}\` is dropped by every browser — \`::${pseudo}\` honours ${(PSEUDO_PROPERTIES[pseudo] ?? []).map(name => `\`${name}\``).join(', ')}. Style the element itself for the rest.`
        );
      }
    }
  }

  if (GENERATED_PSEUDOS.includes(pseudo) && !ruleSets.some(rules => Object.hasOwn(rules, 'content'))) {
    throw new AuthoringError(
      'style-pseudo-content',
      `\`::${pseudo}\` has no \`content\`, so the browser draws nothing for it. Give it one — \`content: '""'\` for an empty box — in its rules or in a state's.`
    );
  }
};

const toPseudos = (pseudos: PseudosSpec | undefined): Map<StylePseudo, PartRules> => {
  const parts = new Map<StylePseudo, PartRules>();
  for (const [name, spec] of Object.entries(pseudos ?? {})) {
    const bare = name.replace(/^:+/, '');
    if (!isStylePseudo(name)) {
      throw new AuthoringError(
        'style-pseudo-unknown',
        `Unknown pseudo-element "${name}"${isStylePseudo(bare) ? ` — write it without the colons, "${bare}"` : didYouMean(bare, STYLE_PSEUDOS)}. A class dresses ${STYLE_PSEUDOS.join(', ')}.`
      );
    }

    const part = partOf(spec);
    const rules: PartRules = { base: toResponsive(part.css), states: toStates(part.states) };
    assertPseudo(name, rules);
    parts.set(name, rules);
  }

  return parts;
};

const pseudosAt = (pseudos: Map<StylePseudo, PartRules>, breakpoint: DisplayMode): StylePseudos | undefined => {
  const entries = [...pseudos].flatMap(([pseudo, { base, states }]) => {
    const rules = base[breakpoint];
    const stateRules = statesAt(states, breakpoint);
    const own = rules && Object.keys(rules).length > 0;

    return own || stateRules
      ? [[pseudo, { ...(own ? { default: rules } : {}), ...(stateRules ? { states: stateRules } : {}) }] as const]
      : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

interface ConditionRules extends PartRules {
  pseudos: Map<StylePseudo, PartRules>;
}

const toConditions = (conditions: RuleSetSpec['conditions']): Map<string, ConditionRules> => {
  const parts = new Map<string, ConditionRules>();
  for (const [key, spec] of Object.entries(conditions ?? {})) {
    const condition = canonicalCondition(key);
    if (!condition) {
      throw new AuthoringError(
        'style-condition-unknown',
        `Unknown condition "${key}"${didYouMean(key, STYLE_MOTION_CONDITIONS)}. A class's rules can hold under ${STYLE_MOTION_CONDITIONS.map(name => `\`${name}\``).join(', ')}, or a container's width — \`container (max-width: 30rem)\`, \`container card (min-width: 480px)\` (min-width, max-width or both joined by \`and\`, in px, rem, em or ch).`
      );
    }

    if (parts.has(condition)) {
      throw new AuthoringError(
        'style-condition-unknown',
        `"${key}" is \`${condition}\`, which the class already writes under another spelling: keep one.`
      );
    }

    const part = partOf(spec);
    parts.set(condition, {
      base: toResponsive(part.css),
      states: toStates(part.states),
      pseudos: toPseudos(part.pseudos)
    });
  }

  return parts;
};

const conditionsAt = (
  conditions: Map<string, ConditionRules>,
  breakpoint: DisplayMode
): StyleConditions | undefined => {
  const entries = [...conditions].flatMap(([condition, { base, states, pseudos }]) => {
    const rules = base[breakpoint];
    const stateRules = statesAt(states, breakpoint);
    const pseudoRules = pseudosAt(pseudos, breakpoint);
    const own = rules && Object.keys(rules).length > 0;

    return own || stateRules || pseudoRules
      ? [
          [
            condition,
            {
              ...(own ? { default: rules } : {}),
              ...(stateRules ? { states: stateRules } : {}),
              ...(pseudoRules ? { pseudos: pseudoRules } : {})
            }
          ] as const
        ]
      : [];
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

  const misplaced = Object.keys(spec).filter(key => RULE_SET_KEYS.has(key) && key !== 'css');
  if (!isRuleSetSpec(spec) && misplaced.length > 0) {
    const rules = Object.keys(spec).filter(key => !RULE_SET_KEYS.has(key));
    throw new AuthoringError(
      'rule-set-mixed',
      `A style writes ${rules.map(key => `\`${key}\``).join(', ')} beside ${misplaced.map(key => `\`${key}\``).join(', ')}. ` +
        'Once a style has states, variants, ancestors, pseudo-elements or conditions, its own rules go under `css`: ' +
        `\`{ css: { ${rules.map(key => `${key}: …`).join(', ')} }, ${misplaced.map(key => `${key}: { … }`).join(', ')} }\`.`
    );
  }

  const ruleSet: RuleSetSpec = isRuleSetSpec(spec) ? spec : { css: spec };
  const base = toResponsive(ruleSet.css);
  const states = toStates(ruleSet.states);
  const variants = Object.entries(ruleSet.variants ?? {}).map(([name, variant]) => [name, toBlocks(variant)] as const);
  const ancestors = toAncestors(ruleSet.ancestors);
  const pseudos = toPseudos(ruleSet.pseudos);
  const conditions = toConditions(ruleSet.conditions);

  const blocks: ResponsiveBlock = {};
  for (const breakpoint of BREAKPOINTS) {
    const rules = base[breakpoint] ?? {};
    const stateRules = statesAt(states, breakpoint);
    const variantRules: StyleVariants = Object.fromEntries(
      variants.flatMap(([name, variantBlocks]) => {
        const block = variantBlocks[breakpoint];

        return block
          ? [
              [
                name,
                {
                  default: block.default ?? {},
                  ...(block.states ? { states: block.states } : {}),
                  ...(block.pseudos ? { pseudos: block.pseudos } : {})
                }
              ]
            ]
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

    const pseudoRules = pseudosAt(pseudos, breakpoint);
    const conditionRules = conditionsAt(conditions, breakpoint);
    if (
      Object.keys(rules).length === 0 &&
      !stateRules &&
      Object.keys(variantRules).length === 0 &&
      Object.keys(ancestorRules).length === 0 &&
      !pseudoRules &&
      !conditionRules
    ) {
      continue;
    }

    const block: StyleBlock = {
      default: rules,
      ...(stateRules ? { states: stateRules } : {}),
      ...(Object.keys(variantRules).length > 0 ? { variants: variantRules } : {}),
      ...(Object.keys(ancestorRules).length > 0 ? { ancestors: ancestorRules } : {}),
      ...(pseudoRules ? { pseudos: pseudoRules } : {}),
      ...(conditionRules ? { conditions: conditionRules } : {})
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
