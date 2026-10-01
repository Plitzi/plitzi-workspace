import { z } from 'zod';

import { componentNamed, instancesOf, removeComponent } from '@plitzi/sdk-schema/helpers/components';

import { componentsUri, empty, fail } from '../../../../helpers';

import type { OpResult, Space } from '../../../../helpers';
import type { Env } from '../../../../types';

export const deleteComponentOp = z
  .object({ type: z.literal('deleteComponent'), ref: z.string() })
  .describe('Remove a component nothing places any more.');

export type DeleteComponent = z.infer<typeof deleteComponentOp>;

export const deleteComponent = (space: Space, env: Env, op: DeleteComponent): OpResult => {
  if (!componentNamed(space.schema, op.ref)) {
    return fail('ref', `Component "${op.ref}" not found`, `Read plitzi://schema/${env}/components for valid refs`);
  }

  const placed = instancesOf(space.schema, op.ref);
  if (placed.length > 0 || !removeComponent(space.schema, op.ref)) {
    return fail(
      'ref',
      `Component "${op.ref}" is still placed by ${placed.map(instance => `"${instance.id}"`).join(', ')}`,
      'detachInstance or deleteElement each of them first'
    );
  }

  return { ...empty(), deleted: 1, staleResources: [componentsUri(env)] };
};
