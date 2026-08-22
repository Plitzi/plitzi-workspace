import { reconcileParams } from '@plitzi/sdk-shared/authoring';

import { spaceCallbacks } from './spaceCallbacks';
import { actionsCallbacks } from '../sources/ActionsSource/callbacks';
import { authCallbacks } from '../sources/AuthSource/callbacks';
import { navigationCallbacks } from '../sources/NavigationSource/callbacks';
import { stateCallbacks } from '../sources/StateSource/callbacks';

import type { BuiltinActionSpec } from '@plitzi/sdk-shared/authoring';

/**
 * Every built-in `globalCallback`, gathered from the sources that implement them.
 *
 * A global callback registers under a fixed module id — `space`, `state`, `navigation`, `auth`, `actions` — and NOT
 * under the element hosting the flow: the runtime resolves one as `callbacksAvailables[elementId][action]` (see
 * `InteractionsHelper`), so a node that stored the host element's idRef here would resolve to nothing and the flow
 * would silently do nothing. That is what `source` below is for.
 *
 * Gathered rather than mirrored. This file used to be a hand-kept copy of what the sources declared, in another
 * repository, and it had fallen behind in three separate places by the time it was replaced.
 */

export interface BuiltinGlobalCallback extends BuiltinActionSpec {
  // The registration id the runtime looks the callback up under — the value a node's `elementId` must carry.
  source: string;
}

export const BUILTIN_GLOBAL_CALLBACKS: Record<string, BuiltinGlobalCallback> = {
  ...spaceCallbacks,
  ...stateCallbacks,
  ...navigationCallbacks,
  ...authCallbacks,
  ...actionsCallbacks
};

/** The built-in globalCallback for an action, or undefined when the action is not a known built-in (a plugin
 *  callback whose source/schema is not knowable here). */
export const getGlobalCallback = (action: string): BuiltinGlobalCallback | undefined =>
  Object.hasOwn(BUILTIN_GLOBAL_CALLBACKS, action) ? BUILTIN_GLOBAL_CALLBACKS[action] : undefined;

/** Resolve a `globalCallback` action against the built-in catalog: returns the module id it is registered under
 *  (`source`) and the params reconciled to the callback's schema — unknown keys dropped for a closed callback, then
 *  missing defaults filled. An action the catalog does not know (e.g. a plugin callback) yields no source and
 *  unchanged params, so the caller keeps its own behavior for it. */
export const applyBuiltinCallback = (
  action: string,
  params: Record<string, unknown>
): { source?: string; params: Record<string, unknown> } => {
  if (!(action in BUILTIN_GLOBAL_CALLBACKS)) {
    return { params };
  }

  const builtin = BUILTIN_GLOBAL_CALLBACKS[action];

  return { source: builtin.source, params: reconcileParams(params, builtin.params, builtin.strictParams) };
};
