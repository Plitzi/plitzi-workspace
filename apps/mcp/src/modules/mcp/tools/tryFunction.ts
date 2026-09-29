import { z } from 'zod';

import { defineTool } from './shared/tool';

import type { ToolContext } from './shared/tool';

export const tryFunctionShape = {
  task: z.string().describe('`<namespace>.<action>`'),
  params: z.record(z.string(), z.unknown()).optional(),
  dryRun: z.boolean().optional()
};

/**
 * Runs one task of the space's functions — the draft, in the sandbox, with the limits and the record any run has — and
 * answers what it returned, what it logged and where it failed. How an agent checks the code it wrote before a page
 * relies on it: the live site only runs what the space was last published with.
 */
export const tryFunction = async (
  input: { task: string; params?: Record<string, unknown>; dryRun?: boolean },
  ctx: ToolContext
): Promise<unknown> => {
  if (input.dryRun) {
    return {
      ran: false,
      reason: 'Trying a function runs its code for real — its fetches and its writes — so not in plan mode'
    };
  }

  if (!ctx.tryFunction) {
    return { ran: false, reason: 'This deployment runs no space functions' };
  }

  const report = await ctx.tryFunction(input.task, input.params ?? {});
  const step = report.steps.find(entry => entry.action === input.task);

  return {
    ran: true,
    status: report.status,
    value: report.output.value,
    ...(step?.error ? { error: step.error } : {}),
    ...(step?.logs ? { logs: step.logs } : {}),
    ...(step ? { ms: step.endTime - step.startTime } : {})
  };
};

export const tryFunctionTool = defineTool({
  name: 'plitzi_try_function',
  title: 'Try function',
  description:
    'Run one task of the space’s functions against the draft, in the sandbox: its value, logs and error. Its writes ' +
    'are real.',
  inputShape: tryFunctionShape,
  access: 'write',
  run: (input, ctx) => tryFunction(input, ctx)
});
