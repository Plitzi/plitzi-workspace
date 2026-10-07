import { z } from 'zod';

import { closest } from '@plitzi/sdk-authoring';

import { OPERATIONS_BY_TYPE } from './operations';
import { defineTool } from './shared/tool';

export const describeOperationShape = {
  type: z
    .string()
    .optional()
    .describe('The operation type, as in a batch: "upsertElement", "patchDefinition"… Left out, every type is listed.')
};

/**
 * One operation's schema, by its type — the low level asked for one piece at a time, so a connection does not have to
 * load all of it to write one operation. A type that does not exist is answered with the closed list and the nearest
 * name: an agent that guessed is told what there is, never left to guess again.
 */
export const describeOperation = (type: string | undefined): Record<string, unknown> => {
  const types = [...OPERATIONS_BY_TYPE.keys()];
  if (type === undefined) {
    return { types };
  }

  const schema = OPERATIONS_BY_TYPE.get(type);
  if (!schema) {
    const nearest = closest(type, types);

    return {
      error: 'UNKNOWN_OPERATION',
      message: `There is no "${type}" operation${nearest ? ` — did you mean "${nearest}"?` : ''}`,
      ...(nearest ? { describe: { type: nearest } } : {}),
      types
    };
  }

  return { type, schema: z.toJSONSchema(schema) };
};

export const describeOperationTool = defineTool({
  name: 'plitzi_describe_operation',
  title: 'Describe an operation',
  description:
    'The schema of one operation plitzi_apply or plitzi_render takes, by its type: every field, which are required, ' +
    'what each means. Without a type, every operation type there is.',
  inputShape: describeOperationShape,
  access: 'read',
  spaceless: true,
  run: input => describeOperation(input.type)
});
