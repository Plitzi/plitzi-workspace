import { resolveLayoutChain } from './layoutChain';

import type { Element, Schema, SpaceComponent } from '../types';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * The element types a page can draw — what decides which plugins a page has to have before it hydrates, and which can
 * wait until a page that draws them is opened.
 *
 * Generous on purpose, because the two mistakes do not cost the same: a type counted that is never drawn only loads a
 * plugin early, while one missed hydrates a page without the component the server drew. So it walks the page and
 * every shell around it, into every component an instance names and every element a reference copies, and it counts
 * what a flag or a visibility binding might hide: those are decided as the page renders, and may change while it is
 * open. A `custom` element counts as the plugin it names (`renderType`), which is what it renders.
 */
export const pageElementTypes = (schema: Schema, pageId: string): Set<string> => {
  const types = new Set<string>();
  const page = schema.flat[pageId] as Element | undefined;
  if (!page) {
    return types;
  }

  const shells = resolveLayoutChain(
    id => schema.flat[id] as Element | undefined,
    text(page.attributes.layout),
    text(page.attributes.layoutContainer)
  ).map(link => link.layout);
  const pending: { flat: Record<string, Element>; id: string }[] = [pageId, ...shells].map(id => ({
    flat: schema.flat,
    id
  }));
  const visited = new Map<Record<string, Element>, Set<string>>();
  while (pending.length > 0) {
    const next = pending.pop();
    if (!next) {
      break;
    }

    const { flat, id } = next;
    const done = visited.get(flat) ?? new Set<string>();
    visited.set(flat, done);
    const element = flat[id] as Element | undefined;
    if (!element || done.has(id)) {
      continue;
    }

    done.add(id);
    const { type, items } = element.definition;
    types.add(type);
    const renderType = text(element.attributes.renderType);
    if (type === 'custom' && renderType) {
      types.add(renderType);
    }

    const referenceId = text(element.attributes.referenceId);
    if (type === 'reference' && referenceId) {
      const component =
        element.attributes.referenceType === 'component'
          ? (schema.components[referenceId] as SpaceComponent | undefined)
          : undefined;
      pending.push(component ? { flat: component.flat, id: component.rootId } : { flat: schema.flat, id: referenceId });
    }

    if (items) {
      pending.push(...items.map(item => ({ flat, id: item })));
    }
  }

  return types;
};
