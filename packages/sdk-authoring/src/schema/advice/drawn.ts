import { resolveLayoutChain } from '@plitzi/sdk-shared/schema';

import type { Element, Schema } from '@plitzi/sdk-shared';

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * A page's elements in the order a visitor meets them: its shells' — the outermost first — with the page inside the
 * container each one takes it in, after what that container holds of its own, as the page is drawn. The shells are
 * part of the page as a browser builds it: a header's `h1` or a layout's `main` is the page's own.
 *
 * `visit` is handed each element once with what its parent handed down, and answers what its children are handed —
 * or `undefined` to skip them, as an element assistive technology is told to skip is skipped with what it holds.
 */
export const walkDrawn = <S>(
  flat: Schema['flat'],
  pageId: string,
  initial: S,
  visit: (element: Element, state: S) => S | undefined
): void => {
  const page = flat[pageId] as Element | undefined;
  if (!page) {
    return;
  }

  // Innermost first: what each shell takes in its container is the next one in, and the last one takes the page.
  const shells = resolveLayoutChain(
    id => flat[id],
    textOf(page.attributes.layout),
    textOf(page.attributes.layoutContainer)
  );
  const inside = new Map<string, string>();
  shells.forEach((link, index) => inside.set(link.slot, index === 0 ? pageId : shells[index - 1].layout));

  const seen = new Set<string>();
  const walk = (id: string, state: S): void => {
    const element = flat[id] as Element | undefined;
    if (!element || seen.has(id)) {
      return;
    }

    seen.add(id);
    const handed = visit(element, state);
    if (handed === undefined) {
      return;
    }

    (element.definition.items ?? []).forEach(item => walk(item, handed));
    const body = inside.get(id);
    if (body !== undefined) {
      walk(body, handed);
    }
  };
  walk(shells.length > 0 ? shells[shells.length - 1].layout : pageId, initial);
};
