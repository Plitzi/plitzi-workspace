import type { Element } from '@plitzi/sdk-shared';

/** One root of the schema — a page, or a layout several pages render inside — and how many elements it holds. */
export interface RootElements {
  page: string;
  elements: number;
}

/**
 * The element count, grouped by the page that holds it, off the LIVE schema.
 *
 * The same grouping the API answers for every other space, done here for the one being edited: those figures are
 * whatever was last saved, and this one moves with the element someone just dropped — which is the whole reason the
 * meter is in the editor rather than on a dashboard.
 *
 * It is a grouping, not a second measurement: it adds up to the element count exactly. Layouts are roots too and are
 * listed as themselves rather than shared out over the pages that render inside them — their elements are authored
 * once, and splitting them between pages would report a total that no page has.
 */
const elementsByRoot = (flat: Record<string, Element>): RootElements[] => {
  const counts = new Map<string, number>();
  const names = new Map<string, string>();
  for (const element of Object.values(flat)) {
    const root = element.definition.rootId;
    counts.set(root, (counts.get(root) ?? 0) + 1);
    // A root points at itself, so the pass that counts is also the pass that learns what each root is called.
    if (element.id === root) {
      const name = (element.attributes as { name?: unknown }).name;
      names.set(root, typeof name === 'string' && name ? name : element.definition.label);
    }
  }

  return [...counts.entries()]
    .map(([root, elements]) => ({ page: names.get(root) ?? root, elements }))
    .sort((a, b) => b.elements - a.elements);
};

export default elementsByRoot;
