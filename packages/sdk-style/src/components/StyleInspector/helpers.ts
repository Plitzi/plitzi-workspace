import { STYLE_STATE_LABELS, STYLE_STATES } from '@plitzi/sdk-shared/style/styleStates';

import type { Option } from '@plitzi/plitzi-ui/Select2';
import type { Element, Schema, StyleAncestor, StyleAncestors } from '@plitzi/sdk-shared';

/** The states a selector can react to, as the state picker offers them — from the one list every layer reads. */
export const STYLE_STATE_OPTIONS: Option[] = STYLE_STATES.map(state => ({
  label: STYLE_STATE_LABELS[state],
  value: state
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

/** The conditions a selector has rules for under one ancestor: `inside`, `hover`, `collapsed`, `collapsed:hover`. */
const conditionsOf = ({ default: rules, states, variants }: StyleAncestor): string[] => [
  ...(Object.keys(rules ?? {}).length ? ['inside'] : []),
  ...Object.keys(states ?? {}),
  ...Object.entries(variants ?? {}).flatMap(([variant, block]) => [
    ...(Object.keys(block.default ?? {}).length ? [variant] : []),
    ...Object.keys(block.states ?? {}).map(state => `${variant}:${state}`)
  ])
];

/**
 * The ancestor picker's options: the element's ancestor classes, closest first, then any class the selector already
 * has rules for that is not around this element. The ones with rules say which conditions, so they read at a glance.
 */
export const ancestorOptions = (candidates: string[], configured: StyleAncestors = {}): Option[] =>
  [...new Set([...candidates, ...Object.keys(configured)])].map(name => {
    const conditions = Object.hasOwn(configured, name) ? conditionsOf(configured[name]) : [];

    return { label: conditions.length ? `.${name} — ${conditions.join(', ')}` : `.${name}`, value: name };
  });
