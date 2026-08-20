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
    z.object({ mode: z.literal('public') }).describe('Anyone, signed out included. Required for a webhook'),
    z.object({ mode: z.literal('session') }).describe('Any visitor with a session'),
    z.object({ mode: z.literal('role'), permissions: z.array(z.string()).min(1) }).describe('Holding all of these')
  ])
  .describe('Who may run this action. No default: an unstated rule is either a lock-out or a hole');

export const actionTrigger = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('call') }).describe('A client flow calls it by name'),
    z
      .object({
        type: z.literal('webhook'),
        verify: z
          .object({
            type: z.literal('hmac'),
            header: z.string().describe('Header carrying the signature, e.g. "stripe-signature"'),
            algorithm: z.enum(['sha256', 'sha1']),
            secret: z.string().describe('Over a declared credential, e.g. "{{credential.stripe.hookSecret}}"'),
            toleranceSeconds: z.number().optional()
          })
          .optional()
          .describe('Without it, anyone who learns the URL can start a run')
      })
      .describe('An external system posts to a public URL'),
    z.object({ type: z.literal('schedule'), cron: z.string(), timezone: z.string().optional() }),
    z.object({ type: z.literal('render') }).describe('Produces data while a page renders'),
    z.object({ type: z.literal('custom'), name: z.string() }).describe('Mounted by the deployment')
  ])
  .describe('What starts a run');

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
    type: z.enum(['trigger', 'task']).describe('Exactly ONE trigger starts the chain; the rest are tasks'),
    action: z
      .string()
      .describe(
        'A trigger names its trigger type ("call"); a task names "<namespace>.<action>" from ' +
          'plitzi://actions/{env}/tasks. A browser step (setState, navigate) cannot run here'
      ),
    params: z.record(z.string(), z.unknown()).default({}),
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
