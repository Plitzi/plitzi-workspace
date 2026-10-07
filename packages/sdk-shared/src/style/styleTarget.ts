import { canonicalCondition } from './styleConditions';
import { isStylePseudo } from './stylePseudos';
import { isParentAncestor } from './styleStates';

import type { StyleBlock, StyleObject, StyleTarget } from '../types/StyleTypes';

/**
 * Where in a selector's block an edit lands, read the same way by the store that writes it, the inspector that shows
 * it and the inheritance that explains it — once, here, rather than once in each.
 *
 * The keys are walked by hand, not through a dotted path: an ancestor key (`>`) and a condition key
 * (`container (max-width: 30.5rem)`) are not path segments any path parser accepts, and must not have to be.
 */

/** The keys from a selector's block down to the rules a target addresses — `['variants', 'primary', 'states', 'hover']`. */
export const styleTargetKeys = (target: StyleTarget): string[] => {
  const keys: string[] = [];
  if (target.styleAncestor) {
    keys.push('ancestors', target.styleAncestor);
  } else if (target.styleCondition) {
    keys.push('conditions', target.styleCondition);
  }

  if (target.styleVariant) {
    keys.push('variants', target.styleVariant);
  }

  if (target.stylePseudo) {
    keys.push('pseudos', target.stylePseudo);
  }

  keys.push(...(target.styleState ? ['states', target.styleState] : ['default']));

  return keys;
};

/**
 * Why a target names no place a block has, or `undefined` when it names one: an ancestor's rules are not under a
 * condition and draw no pseudo-element, a condition has no variants, and the parent (`>`) wears no variant.
 */
export const styleTargetProblem = (target: StyleTarget): string | undefined => {
  if (target.styleAncestor && target.styleCondition) {
    return 'an ancestor condition cannot also be under a condition';
  }

  if (target.styleAncestor && target.stylePseudo) {
    return 'a pseudo-element has no ancestor conditions of its own';
  }

  if (target.styleCondition && target.styleVariant) {
    return 'a condition holds the class’s own rules, not its variants’';
  }

  if (target.styleCondition && canonicalCondition(target.styleCondition) !== target.styleCondition) {
    return `"${target.styleCondition}" is not a condition`;
  }

  if (target.stylePseudo && !isStylePseudo(target.stylePseudo)) {
    return `"${String(target.stylePseudo)}" is not a pseudo-element`;
  }

  if (target.styleAncestor && isParentAncestor(target.styleAncestor) && target.styleVariant) {
    return 'the element around it is named by its state, never by a variant';
  }

  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The value at `keys` under `root`, or `undefined` where any step is missing. */
export const valueAtKeys = (root: unknown, keys: readonly string[]): unknown => {
  let current: unknown = root;
  for (const key of keys) {
    if (!isRecord(current) || !Object.hasOwn(current, key)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
};

/** Writes `value` at `keys` under `root`, making every object on the way that is missing. */
export const setAtKeys = (root: Record<string, unknown>, keys: readonly string[], value: unknown): void => {
  let current = root;
  keys.slice(0, -1).forEach(key => {
    const existing = current[key];
    const next: Record<string, unknown> = isRecord(existing) ? existing : {};
    current[key] = next;
    current = next;
  });

  const last = keys.at(-1);
  if (last !== undefined) {
    current[last] = value;
  }
};

/** Whether a value is one set of rules: properties with a string or a number each. */
export const isStyleRules = (value: unknown): value is StyleObject =>
  isRecord(value) && Object.values(value).every(inner => typeof inner === 'string' || typeof inner === 'number');

/** The rules a target addresses in a block, or `undefined` when the block has none there. */
export const styleTargetRules = (block: StyleBlock | undefined, target: StyleTarget): StyleObject | undefined => {
  const rules = valueAtKeys(block, styleTargetKeys(target));

  return isStyleRules(rules) ? rules : undefined;
};
