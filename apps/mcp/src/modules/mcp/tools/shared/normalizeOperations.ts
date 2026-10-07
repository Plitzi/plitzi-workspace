import { elementTypeNames } from '../../catalogs';
import { buildTypeRegistry } from '../../resources';

import type { Space } from '../../helpers';
import type { ElementInput, Operation } from '../operations';

/**
 * What a batch wrote that has one reading, read that way and said: an element type spelt with other capitals
 * (`Heading`) is the type the catalog spells (`heading`). A guess between two names is never made here — a name with a
 * typo is refused, or warned of, with the nearest one, by the checks that come after.
 */

/** The element types this space renders: the SDK's own and every one its catalog or its elements bring. */
const knownTypes = (space: Space): ReadonlySet<string> =>
  new Set([...Object.keys(buildTypeRegistry(space.schema, space.catalog).types), ...elementTypeNames]);

const normalizedTree = (
  element: ElementInput,
  path: string,
  byLowerCase: ReadonlyMap<string, string>,
  known: ReadonlySet<string>,
  notes: string[]
): ElementInput => {
  const spelt = known.has(element.type) ? undefined : byLowerCase.get(element.type.toLowerCase());
  if (spelt) {
    notes.push(`Read element type "${element.type}" as "${spelt}" (${path}.type): write it as the catalog spells it.`);
  }

  const children = element.children?.map((child, index) =>
    normalizedTree(child, `${path}.children[${String(index)}]`, byLowerCase, known, notes)
  );

  return { ...element, ...(spelt ? { type: spelt } : {}), ...(children ? { children } : {}) };
};

export const normalizeOperations = (
  space: Space,
  operations: Operation[]
): { operations: Operation[]; notes: string[] } => {
  const known = knownTypes(space);
  // Only a spelling one type answers to: were two types told apart by their capitals alone, neither is guessed.
  const spellings = new Map<string, string[]>();
  for (const type of known) {
    spellings.set(type.toLowerCase(), [...(spellings.get(type.toLowerCase()) ?? []), type]);
  }

  const byLowerCase = new Map(
    [...spellings].flatMap(([lower, types]): [string, string][] => (types.length === 1 ? [[lower, types[0]]] : []))
  );
  const notes: string[] = [];
  const normalized = operations.map((operation, index) =>
    operation.type === 'upsertElement'
      ? {
          ...operation,
          element: normalizedTree(operation.element, `operations[${String(index)}].element`, byLowerCase, known, notes)
        }
      : operation
  );

  return { operations: notes.length > 0 ? normalized : operations, notes };
};
