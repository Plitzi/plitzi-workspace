import type { WorkflowElement } from '../WorkflowContext';
import type { Element } from '@plitzi/sdk-shared';

/** The space's elements as the picker lists them, sorted by id — which is also the name an author gave them. */
export const toWorkflowElements = (flat: Record<string, Element> | undefined): WorkflowElement[] =>
  Object.values(flat ?? {})
    .map(({ id, definition }) => ({ id, type: definition.type, label: definition.label }))
    .sort((a, b) => a.id.localeCompare(b.id));

export type PickedElement = { id: string; label: string; missing: boolean };

/** What is picked, in the order it was picked; an id no element answers to any more is kept and flagged. */
export const pickedElements = (ids: readonly string[], elements: readonly WorkflowElement[]): PickedElement[] => {
  const byId = new Map(elements.map(element => [element.id, element]));

  return ids.map(id => {
    const element = byId.get(id);

    return { id, label: element ? `${element.id} · ${element.label}` : id, missing: !element };
  });
};

/** What can still be picked: elements of the type the param asks for, minus the ones already picked. */
export const pickableOptions = (
  elements: readonly WorkflowElement[],
  elementType: string | undefined,
  picked: readonly string[]
): { value: string; label: string }[] =>
  elements
    .filter(element => (!elementType || element.type === elementType) && !picked.includes(element.id))
    .map(element => ({ value: element.id, label: `${element.id} · ${element.label}` }));

/** A stored value read as a list of ids — anything else is nothing picked yet. */
export const toIdList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
