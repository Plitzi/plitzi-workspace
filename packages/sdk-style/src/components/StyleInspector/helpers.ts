import { conditionLabel, STYLE_MOTION_CONDITIONS } from '@plitzi/sdk-shared/style/styleConditions';
import { STYLE_PSEUDO_LABELS, STYLE_PSEUDOS } from '@plitzi/sdk-shared/style/stylePseudos';
import {
  inCascadeOrder,
  isKnownState,
  isParentAncestor,
  PARENT_ANCESTOR,
  STYLE_STATE_LABELS,
  STYLE_STATES
} from '@plitzi/sdk-shared/style/styleStates';

import type { Option } from '@plitzi/plitzi-ui/Select2';
import type {
  DisplayMode,
  Element,
  Schema,
  Style,
  StyleAncestor,
  StyleAncestors,
  StyleBlock,
  StyleItem,
  StyleState
} from '@plitzi/sdk-shared';

/** The states a selector can react to, as the state picker offers them — from the one list every layer reads. */
export const STYLE_STATE_OPTIONS: Option[] = STYLE_STATES.map(state => ({
  label: STYLE_STATE_LABELS[state],
  value: state
}));

/** How an ancestor key reads in the inspector: its class, or the parent it stands for. */
export const ancestorName = (ancestor: string): string =>
  isParentAncestor(ancestor) ? 'the element around it' : `.${ancestor}`;

/** The pseudo-element picker's options, the ones the block already dresses saying so. */
export const pseudoOptions = (block?: StyleBlock): Option[] =>
  STYLE_PSEUDOS.map(pseudo => ({
    label: block?.pseudos?.[pseudo] ? `${STYLE_PSEUDO_LABELS[pseudo]} (set)` : STYLE_PSEUDO_LABELS[pseudo],
    value: pseudo
  }));

/**
 * The condition picker's options: reduced motion and its opposite, then every container query the block already holds.
 * A new container query is typed in (`container (max-width: 30rem)`) and kept only in the spelling
 * `canonicalCondition` reads.
 */
export const conditionOptions = (block?: StyleBlock): Option[] =>
  [...new Set([...STYLE_MOTION_CONDITIONS, ...Object.keys(block?.conditions ?? {})])].map(condition => ({
    label: block?.conditions?.[condition] ? `${conditionLabel(condition)} (set)` : conditionLabel(condition),
    value: condition
  }));

/**
 * The classes an element's ancestors carry, closest first: what an "ancestor" condition can name. Only the base slot
 * counts — a slot's class sits on an inner node of that ancestor, not around the element.
 */
export const ancestorClasses = (flat: Schema['flat'], element?: Element): string[] => {
  const classes = new Set<string>();
  const parentId = element?.definition.parentId;
  let current = parentId ? flat[parentId] : undefined;
  while (current) {
    for (const name of current.definition.styleSelectors.base.split(' ')) {
      if (name) {
        classes.add(name);
      }
    }

    const nextId = current.definition.parentId;
    current = nextId ? flat[nextId] : undefined;
  }

  return [...classes];
};

/** One condition a selector has rules for under an ancestor: inside it always, in a state, a variant or both. */
export type AncestorCondition = { ancestor: string; state?: StyleState; variant?: string; label: string };

const hasRules = (rules?: object): boolean => !!rules && Object.keys(rules).length > 0;

const statesOf = (states: StyleAncestor['states']): StyleState[] =>
  inCascadeOrder(states ?? {})
    .filter(([, rules]) => hasRules(rules))
    .map(([state]) => state)
    .filter(isKnownState);

/** Every condition under every ancestor, in the order they are written in the stylesheet. */
export const ancestorConditions = (ancestors: StyleAncestors = {}): AncestorCondition[] =>
  Object.entries(ancestors).flatMap(([ancestor, { default: rules, states, variants }]) => [
    ...(hasRules(rules) ? [{ ancestor, label: 'inside' }] : []),
    ...statesOf(states).map(state => ({ ancestor, state, label: state })),
    ...Object.entries(variants ?? {}).flatMap(([variant, block]) => [
      ...(hasRules(block.default) ? [{ ancestor, variant, label: variant }] : []),
      ...statesOf(block.states).map(state => ({ ancestor, variant, state, label: `${variant}:${state}` }))
    ])
  ]);

/**
 * The ancestor picker's options: the element's ancestor classes, closest first, then any class the selector already
 * has rules for that is not around this element. The ones with rules say which conditions, so they read at a glance.
 */
export const ancestorOptions = (candidates: string[], configured: StyleAncestors = {}): Option[] => {
  const conditions = ancestorConditions(configured);

  return [...new Set([PARENT_ANCESTOR, ...candidates, ...Object.keys(configured)])].map(name => {
    const labels = conditions.filter(condition => condition.ancestor === name).map(condition => condition.label);
    const label = ancestorName(name);

    return { label: labels.length ? `${label} — ${labels.join(', ')}` : label, value: name };
  });
};

/** The elements a selector dresses: every element of its type for an element selector, its wearers for a class. */
const wearersOf = (flat: Schema['flat'], item: StyleItem): Element[] =>
  Object.values(flat).filter(element =>
    item.type === 'element'
      ? element.definition.type === (item.componentType ?? item.name)
      : Object.values(element.definition.styleSelectors).some(selector => selector.split(' ').includes(item.name))
  );

/**
 * The ancestors a selector has rules for that no element it dresses sits inside — rules that can never match, left
 * behind when a class was renamed or the tree changed. Each wearer's ancestors are walked once.
 */
export const unusedAncestors = (flat: Schema['flat'], item: StyleItem): Set<string> => {
  // The parent is whatever element is around the wearer, so it is never unused
  const named = new Set(
    Object.values(item.attributes)
      .flatMap(block => Object.keys(block.ancestors ?? {}))
      .filter(ancestor => !isParentAncestor(ancestor))
  );
  if (!named.size) {
    return named;
  }

  for (const wearer of wearersOf(flat, item)) {
    ancestorClasses(flat, wearer).forEach(name => named.delete(name));
    if (!named.size) {
      break;
    }
  }

  return named;
};

/** One `styleUpdateSelector` that drops every rule under an ancestor, in one slot at one breakpoint. */
export type AncestorRemoval = { displayMode: DisplayMode; styleSelector: string; styleAncestor: string };

/** Where a selector has rules under any of `ancestors`, at every breakpoint and slot: what purging them takes. */
export const ancestorRemovals = (
  platform: Style['platform'],
  name: string,
  ancestors: Set<string>
): AncestorRemoval[] =>
  (Object.keys(platform) as DisplayMode[]).flatMap(displayMode =>
    // A selector need not exist at every breakpoint
    Object.entries((platform[displayMode][name] as StyleItem | undefined)?.attributes ?? {}).flatMap(
      ([styleSelector, block]) =>
        Object.keys(block.ancestors ?? {})
          .filter(ancestor => ancestors.has(ancestor))
          .map(styleAncestor => ({ displayMode, styleSelector, styleAncestor }))
    )
  );
