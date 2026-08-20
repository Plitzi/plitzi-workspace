import { ActionRunError } from './errors';
import { applyFields } from './scope';
import { findTriggerNode, triggerParams } from './triggers';

import type { ActionAccess, ActionEntry, ActionTriggerType, ElementInteraction, SSRUser } from '@plitzi/sdk-shared';

export type PrecheckParams = {
  trigger: ActionTriggerType;
  input: Record<string, unknown>;
  user?: SSRUser;
  /** Chain of run ids that caused this one. A run naming its own action is a loop. */
  lineage?: string[];
};

/** The entry point that was cleared, and the input that survived its contract. */
export type PrecheckResult = { trigger: ElementInteraction; values: Record<string, unknown> };

const authorize = (access: ActionAccess | undefined, kind: ActionTriggerType, user?: SSRUser) => {
  // A schedule has no caller: nothing about a clock is a session, and demanding a rule here would only invite one
  // that means nothing. Every other way in states its own — the validator refuses a document that does not.
  if (kind === 'schedule') {
    return;
  }

  if (!access) {
    throw new ActionRunError('forbidden', 'This trigger declares no access rule');
  }

  if (access.mode === 'public') {
    return;
  }

  if (!user) {
    throw new ActionRunError('forbidden', 'This action requires a signed-in visitor');
  }

  if (access.mode === 'role') {
    const held = new Set(user.permissions);
    if (access.permissions.some(permission => !held.has(permission))) {
      throw new ActionRunError('forbidden', 'This action requires permissions the caller does not hold');
    }
  }
};

/**
 * Everything that decides whether a run may happen at all, before it costs anything.
 *
 * One implementation, two callers, on purpose. The RUNNER calls it because a deployment mounting its own trigger
 * goes straight there, and a check that lived only in the endpoint would be a check a custom trigger silently
 * skips. The ENDPOINT calls it first because these are pure and cheap, and a refusal that has already taken a
 * concurrency slot and a metering event teaches callers to retry harder for something that was never going to run.
 *
 * Everything it reads about the caller — may they, and with what — is on the TRIGGER STEP, so an action reachable
 * both by a signed webhook and by a page call answers each on its own terms instead of on the loosest of the two.
 *
 * Returns the entry point and the coerced input, so neither caller has to find or validate either twice.
 */
export const precheckRun = (entry: ActionEntry, params: PrecheckParams): PrecheckResult => {
  const { document } = entry;
  if (!document.enabled) {
    throw new ActionRunError('disabled', 'This action is disabled');
  }

  const trigger = findTriggerNode(document.nodes, params.trigger);
  if (!trigger || !trigger.enabled) {
    throw new ActionRunError('forbidden', `This action cannot be started by a "${params.trigger}" trigger`);
  }

  // Catches the loop through the outside world: an action whose HTTP step reaches its own webhook.
  if (params.lineage?.includes(entry.id)) {
    throw new ActionRunError('recursion', 'This action already appears in the run lineage');
  }

  const { access, input = {} } = triggerParams(trigger);
  authorize(access, params.trigger, params.user);

  const { values, missing, invalid } = applyFields(input, params.input);
  if (missing.length > 0 || invalid.length > 0) {
    throw new ActionRunError('invalid_input', `Invalid input: ${[...missing, ...invalid].join(', ')}`);
  }

  return { trigger, values };
};
