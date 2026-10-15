import { z } from 'zod';

import {
  ACTIVITY_LIMIT_MAX,
  ACTIVITY_WAIT_DEFAULT_SECONDS,
  ACTIVITY_WAIT_MAX_SECONDS
} from '@plitzi/sdk-shared/activity';

import { defineTool } from './shared/tool';

import type { ToolContext } from './shared/tool';
import type { SpaceActivityQuery } from '@plitzi/sdk-shared/activity';

export const activityShape = {
  after: z.string().optional().describe('The `cursor` last answered. Left out: the latest, at once'),
  wait: z
    .number()
    .min(0)
    .max(ACTIVITY_WAIT_MAX_SECONDS)
    .optional()
    .describe(`Seconds to wait for something; default ${String(ACTIVITY_WAIT_DEFAULT_SECONDS)}`),
  limit: z.number().int().min(1).max(ACTIVITY_LIMIT_MAX).optional(),
  mine: z.boolean().optional().describe('Include your own writes')
};

/**
 * What happened on the space after a cursor — the draft changed, a version went out, an action failed — waited for when
 * nothing has. How an agent follows a space it works on with others: it learns of a person's edit in the builder, or a
 * run its flow broke, without reading the space again and again. Its own writes are left out, and counted.
 */
export const activity = async (input: SpaceActivityQuery, ctx: ToolContext): Promise<unknown> => {
  if (!ctx.activity) {
    return { read: false, reason: 'This deployment keeps no activity for its spaces' };
  }

  // A first read has nothing to wait after: it answers the latest at once, and the cursor that waits from there.
  return ctx.activity({
    ...input,
    wait: input.after === undefined ? 0 : (input.wait ?? ACTIVITY_WAIT_DEFAULT_SECONDS)
  });
};

export const activityTool = defineTool({
  name: 'plitzi_activity',
  title: 'Space activity',
  description:
    'What happened on the space since you last looked — an edit by a person or another agent, a version out, an ' +
    'action failing — waited for. Start without `after`, then pass back `cursor`.',
  inputShape: activityShape,
  access: 'read',
  documents: false,
  run: (input, ctx) => activity(input, ctx)
});
