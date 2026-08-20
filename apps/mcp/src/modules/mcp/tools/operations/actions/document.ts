import { z } from 'zod';

/**
 * The shared vocabulary of an action document, as the agent writes it.
 *
 * A mirror of `ActionDocument` rather than a looser bag: what the agent sends is what the server stores and the
 * runner executes, so a field it cannot express is a field it cannot author. Every shape here is registered in
 * schemaIds.ts — they appear in two ops each, and an inlined copy is paid for in every request of every
 * conversation, so the prose is kept as short as it can be while still saying what a choice DOES.
 */
export const actionAccess = z
  .discriminatedUnion('mode', [
    z.object({ mode: z.literal('public') }).describe('Anyone, signed out included. What a webhook needs'),
    z.object({ mode: z.literal('session') }).describe('Any visitor with a session'),
    z.object({ mode: z.literal('role'), permissions: z.array(z.string()).min(1) }).describe('Holding all of these')
  ])
  .describe('Who may start a run through THIS way in. No default: an unstated rule is a lock-out or a hole');

export const actionTriggerParams = z
  .object({
    access: z
      .enum(['public', 'session', 'role'])
      .optional()
      .describe('Who may start a run THIS way. Required for every kind but schedule, which has no caller'),
    permissions: z.string().optional().describe('Comma separated; only for access "role"'),
    input: z
      .string()
      .optional()
      .describe('JSON map of ActionField by name: what a caller may send this way. Undeclared keys are DROPPED'),
    verify: z
      .string()
      .optional()
      .describe(
        'webhook only. JSON: {type:"hmac",header,algorithm,credential,secretField?,timestampHeader?,' +
          'toleranceSeconds?}. Without it, anyone who learns the URL can start a run'
      ),
    cron: z.string().optional().describe('schedule only: minute hour day-of-month month day-of-week, UTC'),
    timezone: z.string().optional(),
    name: z.string().optional().describe('custom only: the name the deployment mounts it under')
  })
  .describe('What a TRIGGER step carries. Flat and stringy, as every step param is');

export const actionField = z
  .object({
    type: z.enum(['text', 'number', 'boolean', 'date', 'json', 'file']),
    required: z.boolean().optional(),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
    label: z.string().optional()
  })
  .describe('One typed value');

export const actionNode = z
  .object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['trigger', 'task']).describe('A trigger heads a chain; the rest are tasks'),
    action: z
      .string()
      .describe(
        'A trigger names its KIND — call | webhook | schedule | render | custom — and one action may have ' +
          'several, one per kind, each heading its own chain. A task names "<namespace>.<action>" from ' +
          'plitzi://actions/{env}/tasks. A browser step (setState, navigate) cannot run here'
      ),
    params: z
      .record(z.string(), z.unknown())
      .default({})
      .describe('A task: that task\'s params. A trigger: ActionTriggerParams — access, input, verify, cron'),
    afterNode: z.string().default('').describe('Id of the next step; empty ends the chain'),
    beforeNode: z.string().default(''),
    enabled: z.boolean().default(true),
    when: z.unknown().optional().describe('Rule group; the step is skipped when it does not match'),
    // Lives on the shared step rather than on a patch-only variant: `.extend()` builds a NEW schema, which drops
    // the $ref and pastes this whole shape into the tool listing a second time (measured: it is the difference
    // between fitting the listing budget and blowing it).
    remove: z.boolean().optional().describe('patchAction only: drop this step')
  })
  .describe('One step of the flow');

export const actionLimits = z
  .object({
    timeoutMs: z.number().optional(),
    streamTimeoutMs: z.number().optional(),
    maxNodes: z.number().optional(),
    maxRequests: z.number().optional()
  })
  .describe('Ceilings for one run; may only TIGHTEN what the deployment allows');
