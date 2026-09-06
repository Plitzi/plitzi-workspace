import { z } from 'zod';

import { descendantIds, empty, fail, findLayoutByRef, indexRemoveLayout, pagesUsingLayout } from '../../../../helpers';
import { layoutsUri, pageUri } from '../write';

import type { OpResult, Space } from '../../../../helpers';
import type { Env } from '../../../../types';

export const deleteLayoutOp = z
  .object({ type: z.literal('deleteLayout'), ref: z.string().describe('The layout shell, by name') })
  .describe(
    'Delete a layout shell and everything in it. Refused while a page still renders inside it (detach with ' +
      'upsertPage { layout: null }). Destructive: what it holds is on every page that uses it — confirm first.'
  );

export type DeleteLayout = z.infer<typeof deleteLayoutOp>;

export const deleteLayout = (space: Space, env: Env, op: DeleteLayout): OpResult => {
  const layout = findLayoutByRef(space.schema, op.ref);
  if (!layout) {
    return fail('ref', `Layout "${op.ref}" not found`, `Read plitzi://schema/${env}/layouts for valid refs`);
  }

  /**
   * A shell still in use is not deleted, it is REFUSED — and the pages are named.
   *
   * Deleting it anyway leaves every one of them pointing at a shell that is gone: they render their own body with
   * no chrome at all, and nothing in the document says why. Detaching them silently is no better, because that is
   * a decision about pages the caller did not mention.
   */
  const inUse = pagesUsingLayout(space.schema, layout.id);
  if (inUse.length > 0) {
    return fail(
      'ref',
      `Layout "${op.ref}" is still used by ${inUse.length} page(s): ${inUse.map(page => page.id).join(', ')}`,
      'Detach them first with upsertPage { layout: null }, or point them at another shell'
    );
  }

  const descendantElementIds = descendantIds(space.schema, layout.id);
  const descendants = descendantElementIds.map(id => space.schema.flat[id]);
  for (const id of [...descendantElementIds, layout.id]) {
    Reflect.deleteProperty(space.schema.flat, id);
  }

  indexRemoveLayout(space.schema, layout, descendants);

  return { ...empty(), deleted: 1, staleResources: [pageUri(env, op.ref), layoutsUri(env)] };
};
