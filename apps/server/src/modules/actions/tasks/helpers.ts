import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';

import type { ActionTaskContext } from '../types';

/**
 * Renders a task's own params, with its own credential in scope.
 *
 * This is the shape every task that talks to a third party takes — `http.request` today, `apiCall` and whatever
 * else tomorrow — and it exists so each of them does not invent its own answer to the same question.
 *
 * The credential is resolved HERE, inside the task, and never enters the flow scope. That is the whole point:
 * a secret in the run's scope is interpolable by every other node, including the one that returns values to the
 * browser, and no amount of care in this task would stop that. What a flow can reach is what its tasks chose to
 * hand back — a credential is not that.
 *
 * Tasks using this declare `rawParams: true`, because the runner must not have resolved the params first: a
 * `{{credential.*}}` token would then have been spent against a scope that has no credential in it.
 */
export const renderTaskParams = async <T extends Record<string, unknown>>(
  params: T,
  ctx: ActionTaskContext,
  credentialId?: string
): Promise<T> => {
  const credential = credentialId ? await ctx.credential(credentialId) : undefined;
  if (credentialId && !credential) {
    throw new Error(`Credential "${credentialId}" is not available for this space`);
  }

  const scope = { ...ctx.scope, ...(credential ? { credential } : {}) };

  return Object.entries(params).reduce<Record<string, unknown>>((acum, [key, value]) => {
    acum[key] = typeof value === 'string' ? processTwig(value, scope, false, true) : value;

    return acum;
  }, {}) as T;
};
