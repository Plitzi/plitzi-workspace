import type { Element } from '@plitzi/sdk-shared';

/**
 * The flat schema, typed as it actually behaves.
 *
 * `Record<string, Element>` promises an element for every string there is, so the compiler calls the miss checks
 * below dead code — and a `parentId` naming an element the schema no longer has is exactly what this walk exists
 * to survive. Callers hand over the store's own map, which is assignable to this.
 */
export type ElementLookup = Record<string, Element | undefined>;

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
 * and what an interaction targets — so somebody searching almost always has one in mind. The type is worth least:
 * it matches dozens of elements at once and is really a filter wearing a search's clothes.
 */
const scoreOf = (query: string, id: string, label: string, type: string): number => {
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

  if (label.toLowerCase().includes(query)) {
    return 40;
  }

  if (type.toLowerCase().includes(query)) {
    return 20;
  }

  return 0;
};

/**
 * The chain from an element up to its root, outermost first.
 *
 * Walked through `parentId` rather than read off `rootId`, because the tree the panel opens is the chain of
 * PARENTS: revealing a match six levels down means opening all six, and `rootId` names only the far end of it. The
 * seen-set is not paranoia — a schema edited by two people at once can briefly describe a cycle, and without it
 * this loops forever inside a render.
 */
const chainOf = (flat: ElementLookup, id: string): { rootId: string; ancestors: string[] } => {
  const ancestors: string[] = [];
  const seen = new Set<string>([id]);
  let current = flat[id]?.definition.parentId;
  while (current !== undefined && !seen.has(current)) {
    const parent = flat[current];
    if (!parent) {
      break;
    }

    seen.add(current);
    ancestors.unshift(current);
    current = parent.definition.parentId;
  }

  return { rootId: ancestors[0] ?? id, ancestors };
};

export type SearchOptions = {
  /** Answers past this are noise: nobody scrolls a thousand hits, they type another letter. */
  limit?: number;
  /** The page the author is on. Its matches sort first — that is where they were already looking. */
  currentRootId?: string;
};

/**
 * Every element in the SPACE whose id, label or type matches — not only the ones on the page being edited.
 *
 * Across every page on purpose: the tree can only ever show one page's elements, so an author with forty pages had
 * no way to answer "where is the element called `cta-primary`" except by opening pages until one of them had it.
 * Results carry the root they were found in, so the panel can say which page each one is on and take you there.
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
    const score = scoreOf(needle, id, label, type);
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
