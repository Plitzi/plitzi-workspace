import { componentNamed, isInstance } from '@plitzi/sdk-schema/helpers/components';
import { resolveLayoutChain } from '@plitzi/sdk-shared/schema/layoutChain';

import type { Element, Schema } from '@plitzi/sdk-shared';

export type TreeRow = {
  id: string;
  label: string;
  type: string;
  depth: number;
  /** Starts hidden: its initial visibility is off. */
  hidden: boolean;
  /** The component it places, when it is an instance. */
  instanceOf?: string;
};

export type TreeSection = {
  kind: 'layout' | 'page' | 'component';
  /** The root's id: the layout, the page, the component. */
  id: string;
  title: string;
  rows: TreeRow[];
};

type Document = Pick<Schema, 'flat' | 'components'>;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** A tree in reading order, each element at its depth — `items` followed from `rootId`, a cycle cut where it closes. */
const rowsOf = (flat: Record<string, Element>, rootId: string): TreeRow[] => {
  const rows: TreeRow[] = [];
  const seen = new Set<string>();
  const visit = (id: string, depth: number): void => {
    const element = Object.hasOwn(flat, id) ? flat[id] : undefined;
    if (!element || seen.has(id)) {
      return;
    }

    seen.add(id);
    const instanceOf = isInstance(element) ? text(element.attributes.referenceId) : '';
    rows.push({
      id,
      label: element.definition.label || id,
      type: element.definition.type,
      depth,
      hidden: element.definition.initialState?.visibility === false,
      ...(instanceOf ? { instanceOf } : {})
    });
    for (const child of element.definition.items ?? []) {
      visit(child, depth + 1);
    }
  };
  visit(rootId, 0);

  return rows;
};

/**
 * What renders on a page, as the trees it comes from: the layouts around it, outermost first, the page, and each
 * component an instance places — the components an instance inside one of those places too. A layout's and a
 * component's elements are not in the page's tree, and the page is not all that is on screen.
 */
export const renderTree = (document: Document, pageId: string): TreeSection[] => {
  const page = Object.hasOwn(document.flat, pageId) ? document.flat[pageId] : undefined;
  if (!page) {
    return [];
  }

  const chain = resolveLayoutChain(
    id => (Object.hasOwn(document.flat, id) ? document.flat[id] : undefined),
    text(page.attributes.layout),
    text(page.attributes.layoutContainer)
  );
  const sections: TreeSection[] = [
    ...chain.toReversed().map(({ layout }) => ({
      kind: 'layout' as const,
      id: layout,
      title: document.flat[layout].definition.label || layout,
      rows: rowsOf(document.flat, layout)
    })),
    {
      kind: 'page',
      id: pageId,
      title: text(page.attributes.name) || page.definition.label || pageId,
      rows: rowsOf(document.flat, pageId)
    }
  ];

  const placed = new Set<string>();
  for (let index = 0; index < sections.length; index++) {
    for (const row of sections[index].rows) {
      const component = row.instanceOf ? componentNamed(document, row.instanceOf) : undefined;
      if (component && !placed.has(component.id)) {
        placed.add(component.id);
        sections.push({
          kind: 'component',
          id: component.id,
          title: component.label ?? component.id,
          rows: rowsOf(component.flat, component.rootId)
        });
      }
    }
  }

  return sections;
};

/**
 * The rows a search keeps: each one it matches — by label, id or type — and the rows above it in its tree, so a match
 * is read where it sits. Everything, for an empty search.
 */
export const filterRows = (rows: readonly TreeRow[], query: string): TreeRow[] => {
  const wanted = query.trim().toLowerCase();
  if (!wanted) {
    return [...rows];
  }

  const kept = new Set<number>();
  rows.forEach((row, index) => {
    if (![row.label, row.id, row.type].some(value => value.toLowerCase().includes(wanted))) {
      return;
    }

    kept.add(index);
    let depth = row.depth;
    for (let above = index - 1; above >= 0 && depth > 0; above--) {
      if (rows[above].depth < depth) {
        kept.add(above);
        depth = rows[above].depth;
      }
    }
  });

  return rows.filter((_, index) => kept.has(index));
};
