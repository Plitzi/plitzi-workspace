import { z } from 'zod';

import { actionUri, actionsUri, empty, fail, findActionEntry } from '../../../helpers';

import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';

export const deleteActionOp = z
  .object({
    type: z.literal('deleteAction'),
    ref: z.string().describe('Identifier of the action to remove')
  })
  .describe(
    'Remove a server action. Destructive and not undoable: every step that runs it stops working, on published ' +
      'pages included, and a webhook pointing at it starts failing. Confirm with the user first.'
  );

export type DeleteAction = z.infer<typeof deleteActionOp>;

export const deleteAction = (space: Space, env: Env, op: DeleteAction): OpResult => {
  const entry = findActionEntry(space, op.ref);
  if (!entry) {
    return fail(
      'ref',
      `Action "${op.ref}" does not exist`,
      `Read ${actionsUri(env)} for the actions this space has`,
      space.actions.map(item => item.id)
    );
  }

  space.actions = space.actions.filter(item => item.id !== op.ref);

  return { ...empty(), deleted: 1, staleResources: [actionsUri(env), actionUri(env, op.ref)] };
};
