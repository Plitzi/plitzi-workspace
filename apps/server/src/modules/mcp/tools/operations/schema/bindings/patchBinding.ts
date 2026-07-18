import { z } from 'zod';

import { empty, fail } from '../../../../helpers';
import { bindingCategory, bindingInput } from '../shared';
import { pageUri, resolveElement } from '../write';

import type { OpResult, Space } from '../../../../helpers';
import type { Env } from '../../../../types';

export const patchBindingOp = z
  .object({
    type: z.literal('patchBinding'),
    pageRef: z.string().describe('Page ref or id'),
    ref: z.string().describe('Element ref or id'),
    category: bindingCategory,
    to: z.string().describe('Target of the binding to patch'),
    id: z.string().optional().describe('Match by id instead of to'),
    source: bindingInput.shape.source.optional(),
    transformers: bindingInput.shape.transformers,
    when: bindingInput.shape.when,
    enabled: bindingInput.shape.enabled
  })
  .describe(
    'Partially update an EXISTING binding (matched by id when given, else by to): only the fields you pass change. ' +
      'Never creates — fails if no binding matches.'
  );

export type PatchBinding = z.infer<typeof patchBindingOp>;

export const patchBinding = (space: Space, env: Env, op: PatchBinding): OpResult => {
  const found = resolveElement(space, env, op.pageRef, op.ref);
  if ('error' in found) {
    return found.error;
  }

  const list = found.el.definition.bindings?.[op.category];
  const binding = list?.find(b => (op.id ? b.id === op.id : b.to === op.to));
  if (!binding) {
    return fail(
      'to',
      `No ${op.category} binding matching "${op.id ?? op.to}" on "${op.ref}"`,
      'Use upsertBinding to add it'
    );
  }

  if (op.source !== undefined) {
    binding.source = op.source;
  }

  if (op.transformers !== undefined) {
    binding.transformers = op.transformers;
  }

  if (op.when !== undefined) {
    binding.when = op.when;
  }

  if (op.enabled !== undefined) {
    binding.enabled = op.enabled;
  }

  return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};
