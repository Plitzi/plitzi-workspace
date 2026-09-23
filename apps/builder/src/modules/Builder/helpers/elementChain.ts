import { parentChain } from '@plitzi/sdk-schema/helpers/elementTree';

import type { Element } from '@plitzi/sdk-shared';

/**
 * The flat schema, typed as it actually behaves.
 *
 * `Record<string, Element>` promises an element for every string there is, so the compiler calls the miss checks
 * below dead code — and a `parentId` naming an element the schema no longer has is exactly what this walk exists
 * to survive. Callers hand over the store's own map, which is assignable to this.
 */
export type ElementLookup = Record<string, Element | undefined>;

/**
 * The chain from an element up to its root, outermost first.
 *
 * Walked through `parentId` rather than read off `rootId`, because the tree the panel opens is the chain of
 * PARENTS: revealing a match six levels down means opening all six, and `rootId` names only the far end of it. The
 * walk is sdk-schema's `parentChain`, the one every reader of the tree shares.
 */
export const chainOf = (flat: ElementLookup, id: string): { rootId: string; ancestors: string[] } => {
  const ancestors = parentChain(flat, id).reverse();

  return { rootId: ancestors[0] ?? id, ancestors };
};

/** Whether an element lives in the page or layout `rootId` — the root itself included. */
export const isInRoot = (flat: ElementLookup, id: string | undefined, rootId: string): boolean =>
  id !== undefined && chainOf(flat, id).rootId === rootId;
