import { correct } from './values';

import type { SpecReader } from './reader';
import type { Roots } from './types';
import type { Element } from '@plitzi/sdk-shared';

/** The root element of each component, where the document holds one. */
export const componentRoots = (roots: Roots): Element[] => {
  return roots.components.flatMap(component =>
    Object.hasOwn(component.flat, component.rootId) ? [component.flat[component.rootId]] : []
  );
};

export const childrenOf = (reader: SpecReader, element: Element, report = true): Element[] => {
  return (element.definition.items ?? []).flatMap(id => {
    const child = reader.flat[id] as Element | undefined;
    if (!child) {
      if (report) {
        correct(
          reader,
          'missing-element',
          `"${element.id}" lists "${id}" as a child, which the document does not hold.`,
          element.id
        );
      }

      return [];
    }

    return [child];
  });
};

export const dropField = (reader: SpecReader, field: string): void => {
  reader.droppedFields.set(field, (reader.droppedFields.get(field) ?? 0) + 1);
};
