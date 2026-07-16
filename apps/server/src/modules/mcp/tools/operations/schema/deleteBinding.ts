import { z } from 'zod';

import { bindingCategory } from './shared';
import { pageUri, resolveElement } from './write';
import { empty, fail } from '../../../helpers';

import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';

export const deleteBindingOp = z
  .object({
    type: z.literal('deleteBinding'),
    pageRef: z.string().describe('Page ref or id'),
    ref: z.string().describe('Element ref or id'),
    category: bindingCategory,
    to: z.string().describe('Target of the binding to remove'),
    id: z.string().optional().describe('Match by id instead of to')
  })
  .describe('Remove a data binding from an element (matched by id when given, else by to). Fails if none matches.');

export type DeleteBinding = z.infer<typeof deleteBindingOp>;

export const deleteBinding = (space: Space, env: Env, op: DeleteBinding): OpResult => {
  const found = resolveElement(space, env, op.pageRef, op.ref);
  if ('error' in found) {
    return found.error;
  }

  const bindings = found.el.definition.bindings;
  const list = bindings?.[op.category];
  const index = list ? list.findIndex(b => (op.id ? b.id === op.id : b.to === op.to)) : -1;
  if (!bindings || !list || index < 0) {
    return fail('to', `No ${op.category} binding matching "${op.id ?? op.to}" on "${op.ref}"`, 'Nothing to delete');
  }

  list.splice(index, 1);
  if (list.length === 0) {
    Reflect.deleteProperty(bindings, op.category);
  }

  return { ...empty(), deleted: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};
