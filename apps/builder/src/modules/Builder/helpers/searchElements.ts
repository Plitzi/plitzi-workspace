import { chainOf } from './elementChain';

import type { ElementLookup } from './elementChain';

export type ElementMatch = {
  id: string;
  type: string;
  /** Free display text, shown only when it says something the id does not. */
  label?: string;
  /** The page or layout this element lives in — where the search has to take you before it can select it. */
  rootId: string;
  /** The ids between the root and this element, outermost first: what the tree has to open to reveal it. */
  ancestors: string[];
  score: number;
};

/**
 * Where the match landed, ranked so the obvious answer comes first.
 *
 * The id is worth more than anything else because the id IS the name — it is what a binding reads this element by
 * and what an interaction targets — so somebody searching almost always has one in mind. A page's name ranks with
 * the label: it is the text the directory shows for that page, so it is what an author remembers it by. The type is
 * worth least: it matches dozens of elements at once and is really a filter wearing a search's clothes.
 */
const scoreOf = (query: string, id: string, texts: string[], type: string): number => {
  const lowerId = id.toLowerCase();
  if (lowerId === query) {
    return 100;
  }

  if (lowerId.startsWith(query)) {
    return 80;
  }

  if (lowerId.includes(query)) {
    return 60;
  }

  if (texts.some(text => text.toLowerCase().includes(query))) {
    return 40;
  }

  if (type.toLowerCase().includes(query)) {
    return 20;
  }

  return 0;
};

export type SearchOptions = {
  /** Answers past this are noise: nobody scrolls a thousand hits, they type another letter. */
  limit?: number;
  /** The page the author is on. Its matches sort first — that is where they were already looking. */
  currentRootId?: string;
};

/**
 * Every element in the SPACE whose id, label, page name or type matches — not only the ones on the page being
 * edited.
 *
 * Across every page and layout on purpose: the tree can only ever show one root's elements, so an author with forty
 * pages had no way to answer "where is the element called `cta-primary`" except by opening pages until one of them
 * had it. Results carry the root they were found in, so the panel can say where each one is and take you there.
 */
export const searchElements = (
  flat: ElementLookup,
  query: string,
  { limit = 50, currentRootId }: SearchOptions = {}
): ElementMatch[] => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [];
  }

  const matches: ElementMatch[] = [];
  for (const element of Object.values(flat)) {
    if (!element) {
      continue;
    }

    const { id } = element;
    const { label = '', type } = element.definition;
    const { name } = element.attributes;
    const texts = typeof name === 'string' ? [label, name] : [label];
    const score = scoreOf(needle, id, texts, type);
    if (score === 0) {
      continue;
    }

    const { rootId, ancestors } = chainOf(flat, id);
    matches.push({
      id,
      type,
      label: label && label.toLowerCase() !== id.toLowerCase() ? label : undefined,
      rootId,
      ancestors,
      score
    });
  }

  matches.sort((a, b) => {
    // The page in front of the author wins a tie, whatever the ids say: it is the one they can see.
    const onCurrent = Number(b.rootId === currentRootId) - Number(a.rootId === currentRootId);
    if (onCurrent !== 0) {
      return onCurrent;
    }

    return b.score - a.score || a.id.localeCompare(b.id);
  });

  return matches.slice(0, limit);
};

/** What to call a root in the results: its page name if it has one, otherwise its label, otherwise its id. */
export const rootName = (flat: ElementLookup, rootId: string): string => {
  const root = flat[rootId];
  if (!root) {
    return rootId;
  }

  const name = root.attributes.name;

  return (typeof name === 'string' && name) || root.definition.label || rootId;
};
