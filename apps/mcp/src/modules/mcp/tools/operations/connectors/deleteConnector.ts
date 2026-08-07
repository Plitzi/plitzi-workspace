import { z } from 'zod';

import { connectorUri, connectorsUri, empty, fail, findConnectorEntry } from '../../../helpers';

import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';

export const deleteConnectorOp = z
  .object({
    type: z.literal('deleteConnector'),
    ref: z.string().describe('Identifier of the connector to remove')
  })
  .describe(
    'Remove a connector. Destructive and not undoable: every provider element pointing at it stops resolving and ' +
      'its page renders empty. Confirm with the user first.'
  );

export type DeleteConnector = z.infer<typeof deleteConnectorOp>;

export const deleteConnector = (space: Space, env: Env, op: DeleteConnector): OpResult => {
  const entry = findConnectorEntry(space, op.ref);
  if (!entry) {
    return fail(
      'ref',
      `Connector "${op.ref}" does not exist`,
      `Read ${connectorsUri(env)} for the connectors this space has`,
      space.connectors.map(item => item.id)
    );
  }

  space.connectors = space.connectors.filter(item => item.id !== op.ref);

  return { ...empty(), deleted: 1, staleResources: [connectorsUri(env), connectorUri(env, op.ref)] };
};
