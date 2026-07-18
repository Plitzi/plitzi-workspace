import { slugRouteParams } from '../../../helpers';

import type { Operation } from '../../operations';

// Batch pre-scans: names an op may legally reference even though they are not in the space yet, because an earlier
// op in the SAME batch declares them. They prevent false "does not exist" errors/warnings on create-then-use flows.

// Variables and route params (page slugs) the batch itself declares — keeps checkVarRefs from false-warning.
export const batchDeclaredVars = (ops: Operation[]): string[] => {
  const names: string[] = [];
  for (const op of ops) {
    if (op.type === 'upsertVariable') {
      names.push(op.name);
    } else if (op.type === 'upsertPage' && typeof op.slug === 'string') {
      names.push(...slugRouteParams(op.slug));
    }
  }

  return names;
};

// Page refs the batch itself creates via upsertPage, so a later op in the same batch can target the new page
// (e.g. "create a page AND fill it in one apply") without a false "page does not exist". Runtime still enforces
// order: an element op that runs before its page is created fails with a clear pageRef error.
export const batchDeclaredPages = (ops: Operation[]): Set<string> => {
  const refs = new Set<string>();
  for (const op of ops) {
    if (op.type === 'upsertPage') {
      refs.add(op.ref);
    }
  }

  return refs;
};

// Folder refs the batch itself creates via upsertFolder, so a later op (a page joining it, or a nested folder) can
// target the new folder in the same apply without a false "folder does not exist".
export const batchDeclaredFolders = (ops: Operation[]): Set<string> => {
  const refs = new Set<string>();
  for (const op of ops) {
    if (op.type === 'upsertFolder') {
      refs.add(op.ref);
    }
  }

  return refs;
};

// Variant names each class declares within this same batch (upsertDefinition/patchDefinition), so applying a
// variant an earlier op in the batch just created does not false-warn.
export const batchDeclaredVariants = (ops: Operation[]): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  for (const op of ops) {
    if (op.type !== 'upsertDefinition' && op.type !== 'patchDefinition') {
      continue;
    }

    const names = new Set<string>(Object.keys(op.variants ?? {}));
    for (const slot of Object.values(op.slots ?? {})) {
      for (const name of Object.keys(slot.variants ?? {})) {
        names.add(name);
      }
    }

    if (names.size > 0) {
      map.set(op.ref, new Set([...(map.get(op.ref) ?? []), ...names]));
    }
  }

  return map;
};
