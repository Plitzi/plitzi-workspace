import type { Element } from '../types';

/** One shell a page is rendered inside: the layoutContainer element, and the container in it that takes the body. */
export type LayoutLink = { layout: string; slot: string };

/** Deeper than any real site nests shells; the bound is only there so a malformed document cannot loop. */
const MAX_DEPTH = 16;

const attribute = (element: Element | undefined, key: string): string => {
  const value: unknown = element?.attributes[key];

  return typeof value === 'string' ? value : '';
};

/**
 * The shells around a page, innermost first.
 *
 * A page names ONE shell (`layout`) and the container in it its body goes into (`layoutContainer`). That shell may
 * name one of its own the same way — analytics pages share a header and tabs, and that header sits inside the
 * platform's sidebar shell — so the chain is followed until a shell names none. A shell the document does not hold, or
 * one already in the chain, ends it: a cycle is a mistake in the document, and rendering it would never finish.
 */
export const resolveLayoutChain = (
  getElement: (id: string) => Element | undefined,
  layout: string,
  layoutContainer: string
): LayoutLink[] => {
  const chain: LayoutLink[] = [];
  const seen = new Set<string>();
  let current = layout;
  let slot = layoutContainer;
  while (current && !seen.has(current) && chain.length < MAX_DEPTH) {
    const element = getElement(current);
    if (element?.definition.type !== 'layoutContainer') {
      break;
    }

    seen.add(current);
    chain.push({ layout: current, slot: slot || current });
    current = attribute(element, 'layout');
    slot = attribute(element, 'layoutContainer');
  }

  return chain;
};

/** The layouts a chain passes through that close it on itself, if any: `layout` → … → `layout`. */
export const findLayoutCycle = (getElement: (id: string) => Element | undefined, layout: string): string[] => {
  const path: string[] = [];
  let current = layout;
  while (current && path.length <= MAX_DEPTH) {
    if (path.includes(current)) {
      return [...path.slice(path.indexOf(current)), current];
    }

    path.push(current);
    current = attribute(getElement(current), 'layout');
  }

  return [];
};
