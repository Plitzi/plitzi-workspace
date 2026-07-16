import { z } from 'zod';

import { bindingCategory, bindingInput } from './shared';
import { pageUri, resolveElement } from './write';
import { empty, generateObjectId } from '../../../helpers';

import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';
import type { ElementBinding } from '@plitzi/sdk-shared';

export const upsertBindingOp = z
  .object({
    type: z.literal('upsertBinding'),
    pageRef: z.string().describe('Page ref or id'),
    ref: z.string().describe('Element ref or id'),
    category: bindingCategory,
    binding: bindingInput
  })
  .describe(
    'Add a data binding to an element, or replace the one already feeding the same target (matched by binding.id ' +
      'when given, else by binding.to). Connects a data source to a prop, style value, or initialState key.'
  );

export type UpsertBinding = z.infer<typeof upsertBindingOp>;

export const upsertBinding = (space: Space, env: Env, op: UpsertBinding): OpResult => {
  const found = resolveElement(space, env, op.pageRef, op.ref);
  if ('error' in found) {
    return found.error;
  }

  const bindings = (found.el.definition.bindings ??= {});
  const list = (bindings[op.category] ??= []);
  const index = list.findIndex(b => (op.binding.id ? b.id === op.binding.id : b.to === op.binding.to));
  const id = op.binding.id ?? (index >= 0 ? list[index].id : generateObjectId());

  const binding: ElementBinding = { id, to: op.binding.to, source: op.binding.source };
  if (op.binding.transformers) {
    binding.transformers = op.binding.transformers;
  }

  if (op.binding.when !== undefined) {
    binding.when = op.binding.when;
  }

  if (op.binding.enabled !== undefined) {
    binding.enabled = op.binding.enabled;
  }

  if (index >= 0) {
    list[index] = binding;

    return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
  }

  list.push(binding);

  return { ...empty(), created: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};
