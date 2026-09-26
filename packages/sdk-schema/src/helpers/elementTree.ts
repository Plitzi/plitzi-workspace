import type { Element, Schema } from '@plitzi/sdk-shared';

/**
 * The flat schema, typed as it actually behaves: a `parentId` or an item can name an element the document no longer
 * has, and every walk here has to survive that. `Record<string, Element>` would call those checks dead code.
 */
type Flat = Schema['flat'] | Record<string, Element | undefined>;

const elementIn = (flat: Flat, id: string | null | undefined): Element | undefined =>
  id && Object.hasOwn(flat, id) ? flat[id] : undefined;

/**
 * The elements `id` is nested in, nearest first, up to its page or layout root.
 *
 * The tree as it is stored — no layout crossed. What the builder opens to reveal an element, and what "inside a list"
 * means for an author. A schema edited by two people at once can briefly describe a cycle, so every id is visited once.
 */
export const parentChain = (flat: Flat, id: string): string[] => {
  const chain: string[] = [];
  const seen = new Set([id]);
  for (let parent = elementIn(flat, elementIn(flat, id)?.definition.parentId); parent;) {
    if (seen.has(parent.id)) {
      break;
    }

    seen.add(parent.id);
    chain.push(parent.id);
    parent = elementIn(flat, parent.definition.parentId);
  }

  return chain;
};

/**
 * Everything an element renders inside, nearest first: its ancestors and, past a page or a layout that is shown in a
 * layout, the container that shell renders it in and that container's own ancestors — through as many layouts as are
 * nested.
 *
 * What the runtime walks to decide which data sources an element sees, so it is what any check of that — the linter's
 * scope rules — has to walk too. A provider elsewhere in the layout, beside the slot rather than around it, is not in
 * it.
 */
export const renderContext = (flat: Flat, id: string): string[] => {
  const context: string[] = [];
  const seen = new Set([id]);
  const climb = (fromId: string) => {
    for (const ancestorId of [fromId, ...parentChain(flat, fromId)]) {
      const ancestor = elementIn(flat, ancestorId);
      if (ancestorId !== fromId || fromId !== id) {
        if (seen.has(ancestorId)) {
          continue;
        }

        seen.add(ancestorId);
        context.push(ancestorId);
      }

      const type = ancestor?.definition.type;
      const { layout, layoutContainer } = ancestor?.attributes ?? {};
      if (
        (type === 'page' || type === 'layoutContainer') &&
        layout &&
        typeof layoutContainer === 'string' &&
        !seen.has(layoutContainer)
      ) {
        climb(layoutContainer);
      }
    }
  };

  climb(id);

  return context;
};

/** Every element under `id`, depth first in document order. Items that name nothing are skipped; a cycle is walked once. */
export const descendants = (flat: Flat, id: string): string[] => {
  const found: string[] = [];
  const seen = new Set([id]);
  const walk = (parentId: string) => {
    for (const childId of elementIn(flat, parentId)?.definition.items ?? []) {
      if (seen.has(childId) || !elementIn(flat, childId)) {
        continue;
      }

      seen.add(childId);
      found.push(childId);
      walk(childId);
    }
  };

  walk(id);

  return found;
};

/** What the author calls a page or layout: its `name`, else its label, else the id when the root is not in `flat`. */
export const rootName = (flat: Flat, rootId: string): string => {
  const root = elementIn(flat, rootId);
  if (!root) {
    return rootId;
  }

  const { name } = root.attributes;

  return typeof name === 'string' && name ? name : root.definition.label;
};

/** One root of a schema — a page, or a layout several pages render inside — and how many elements it holds. */
export type RootElements = {
  /** What the author called it (`rootName`). */
  page: string;
  elements: number;
};

/**
 * The element count, grouped by the root each element names (`definition.rootId`), heaviest first. `only` narrows it
 * to the elements it accepts — where a plugin is used, say — still named after the page or layout that holds them.
 *
 * Unnarrowed it is a grouping, not a second measurement: it always adds up to the number of elements in `flat`, so the
 * builder's live meter and the API's usage panel agree with the count the element ceilings are judged on. Layouts are
 * roots too and are listed as themselves rather than shared out over the pages that render inside them — their
 * elements are authored once, and splitting them between pages would report a total that no page has.
 */
export const elementsByRoot = (flat: Flat, only: (element: Element) => boolean = () => true): RootElements[] => {
  const counts = new Map<string, number>();
  for (const element of Object.values(flat)) {
    if (element && only(element)) {
      const root = element.definition.rootId;
      counts.set(root, (counts.get(root) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([root, elements]) => ({ page: rootName(flat, root), elements }))
    .sort((a, b) => b.elements - a.elements);
};
