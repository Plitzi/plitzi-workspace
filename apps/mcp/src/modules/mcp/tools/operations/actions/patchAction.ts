import { z } from 'zod';

import { validateActionDocument } from '@plitzi/sdk-shared/actions';

import { actionField, actionLimits, actionNode } from './document';
import { actionUri, actionsUri, empty, fail, findActionEntry } from '../../../helpers';

import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';
import type { ElementInteraction } from '@plitzi/sdk-shared';

export const patchActionOp = z
  .object({
    type: z.literal('patchAction'),
    ref: z.string().describe('Identifier of the action to change'),
    name: z.string().optional(),
    description: z.string().optional(),
    output: z.record(z.string(), actionField.nullable()).optional().describe('Merged by name; null removes one'),
    nodes: z
      .array(actionNode)
      .optional()
      .describe('Steps merged BY ID: unlisted ones are preserved, one with remove:true is dropped'),
    limits: actionLimits.optional()
  })
  .describe('Change part of a server action, preserving what you do not send. Never creates; use upsertAction.');

export type PatchAction = z.infer<typeof patchActionOp>;

/** Overlay a name-keyed map: a listed key replaces, a null removes, an unlisted one is preserved. */
const mergeMap = <T>(current: Record<string, T>, patch: Record<string, T | null> | undefined): Record<string, T> => {
  if (!patch) {
    return current;
  }

  const removed = new Set(
    Object.entries(patch)
      .filter(([, value]) => value === null)
      .map(([key]) => key)
  );

  return Object.fromEntries(Object.entries({ ...current, ...patch }).filter(([key]) => !removed.has(key))) as Record<
    string,
    T
  >;
};

export const patchAction = (space: Space, env: Env, op: PatchAction): OpResult => {
  const entry = findActionEntry(space, op.ref);
  if (!entry) {
    return fail(
      'ref',
      `Action "${op.ref}" does not exist`,
      `Create it with upsertAction, or read ${actionsUri(env)} for the actions this space has`,
      space.actions.map(item => item.id)
    );
  }

  const { document } = entry;
  const nodes = { ...document.nodes };
  for (const node of op.nodes ?? []) {
    if (node.remove) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete nodes[node.id];
      continue;
    }

    // Read through an explicitly nullable view: an index access is typed as always-present here, and a step id the
    // patch invents has no stored counterpart.
    const previous = nodes[node.id] as ElementInteraction | undefined;
    nodes[node.id] = {
      ...previous,
      id: node.id,
      title: node.title,
      type: node.type,
      action: node.action,
      params: node.params,
      preview: previous?.preview ?? {},
      elementId: null,
      beforeNode: node.beforeNode,
      afterNode: node.afterNode,
      flowId: previous?.flowId ?? node.id,
      enabled: node.enabled,
      ...(node.when === undefined ? {} : { when: node.when as ElementInteraction['when'] })
    };
  }

  const patched = {
    ...document,
    ...(op.name === undefined ? {} : { name: op.name }),
    ...(op.description === undefined ? {} : { description: op.description }),
    ...(op.limits === undefined ? {} : { limits: op.limits }),
    // Derived from the output step, so a document may simply not carry it yet.
    output: mergeMap(document.output ?? {}, op.output),
    nodes
  };

  // Validated on the MERGED document, not the patch: a change is only safe in the company of what it lands on —
  // removing the step that returned the output is the obvious way to break a flow one field at a time.
  const report = validateActionDocument(patched);
  if (!report.valid) {
    return fail('nodes', `Invalid action: ${report.errors.map(issue => issue.message).join('; ')}`, '', []);
  }

  entry.document = patched;

  return { ...empty(), updated: 1, staleResources: [actionsUri(env), actionUri(env, op.ref)] };
};
