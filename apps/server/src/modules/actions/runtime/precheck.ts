import { ActionRunError } from './errors';
import { applyFields } from './scope';

import type { ActionDocument, ActionEntry, ActionTriggerType, SSRUser } from '@plitzi/sdk-shared';

export type PrecheckParams = {
  trigger: ActionTriggerType;
  input: Record<string, unknown>;
  user?: SSRUser;
  /** Chain of run ids that caused this one. A run naming its own action is a loop. */
  lineage?: string[];
};

const authorize = (document: ActionDocument, user?: SSRUser) => {
  const { access } = document;
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
 * Returns the coerced input so neither caller has to validate twice to use it.
 */
export const precheckRun = (entry: ActionEntry, params: PrecheckParams): Record<string, unknown> => {
  const { document } = entry;
  if (!document.enabled) {
    throw new ActionRunError('disabled', 'This action is disabled');
  }

  if (!document.triggers.some(trigger => trigger.type === params.trigger)) {
    throw new ActionRunError('forbidden', `This action does not declare the "${params.trigger}" trigger`);
  }

  // Catches the loop through the outside world: an action whose HTTP step reaches its own webhook.
  if (params.lineage?.includes(entry.id)) {
    throw new ActionRunError('recursion', 'This action already appears in the run lineage');
  }

  authorize(document, params.user);

  const { values, missing, invalid } = applyFields(document.input, params.input);
  if (missing.length > 0 || invalid.length > 0) {
    throw new ActionRunError('invalid_input', `Invalid input: ${[...missing, ...invalid].join(', ')}`);
  }

  return values;
};
