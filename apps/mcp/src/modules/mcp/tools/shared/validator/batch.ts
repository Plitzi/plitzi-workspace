import { slugRouteParams } from '../../../helpers';

import type { Operation } from '../../operations';
import type { ElementInput } from '../../operations/schema/shared';

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
    // A layout shell is a root a later op addresses by `pageRef` exactly as it addresses a page, so a batch that
    // creates the shell and fills it in one go must be allowed to name it before it exists.
    if (op.type === 'upsertPage' || op.type === 'upsertLayout') {
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

type VariantSource = {
  variants?: Record<string, unknown>;
  slots?: Record<string, { variants?: Record<string, unknown> }>;
};

// Every variant name one class declares, base slot and named slots together.
const variantNamesOf = (source: VariantSource): Set<string> => {
  const names = new Set<string>(Object.keys(source.variants ?? {}));
  for (const slot of Object.values(source.slots ?? {})) {
    for (const name of Object.keys(slot.variants ?? {})) {
      names.add(name);
    }
  }

  return names;
};

// Variant names each class declares within this same batch (upsertDefinition/upsertDefinitions/patchDefinition),
// so applying a variant an earlier op in the batch just created does not false-warn.
export const batchDeclaredVariants = (ops: Operation[]): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  const record = (ref: string, names: Set<string>): void => {
    if (names.size > 0) {
      map.set(ref, new Set([...(map.get(ref) ?? []), ...names]));
    }
  };

  for (const op of ops) {
    if (op.type === 'upsertDefinitions') {
      for (const [ref, definition] of Object.entries(op.definitions)) {
        record(ref, variantNamesOf(definition));
      }

      continue;
    }

    if (op.type === 'upsertDefinition' || op.type === 'patchDefinition') {
      record(op.ref, variantNamesOf(op));
    }
  }

  return map;
};

// Every element ref the batch itself creates via upsertElement, walking the nested `children` because one op
// authors a whole subtree. Repeats are already unrolled by expandOperations before validation runs, so the
// numbered refs a repeatElement produces ("step-1", "step-2"…) are in here too. Lets an interaction step target
// an element the same batch is creating without a false "does not exist".
export const batchDeclaredElements = (ops: Operation[]): Set<string> => {
  const refs = new Set<string>();
  const walk = (input: ElementInput): void => {
    refs.add(input.ref);
    for (const child of input.children ?? []) {
      walk(child);
    }
  };

  for (const op of ops) {
    if (op.type === 'upsertElement') {
      walk(op.element);
    }
  }

  return refs;
};
