import type { Element } from '@plitzi/sdk-shared';

export type BreadcrumbStep = { id: string; label: string; type: string };

/** The way from the root to an element, each step its label and type; an id the document lacks is one unknown step. */
export const pathOf = (flat: Record<string, Element>, id?: string): BreadcrumbStep[] => {
  if (!id) {
    return [];
  }

  const element = flat[id] as Element | undefined;
  if (!element) {
    return [{ id, label: 'unknown', type: 'unknown' }];
  }

  const {
    definition: { parentId, label, type }
  } = element;

  if (!parentId) {
    return [{ id, label, type }];
  }

  return [...pathOf(flat, parentId), { id, label, type }];
};
