import { use, useCallback } from 'react';

import { ServerActionContext } from '@plitzi/sdk-interactions/sources/ActionsSource/ServerActionContext';

import type { CallInputOf, CallOutputOf } from '@plitzi/sdk-shared';

/** What a run answers a plugin: the action's output, or why there is none. */
export type ServerActionResult<Output> =
  | { ok: true; runId: string; output: Output }
  | {
      ok: false;
      runId: string;
      /** The server's word — `forbidden`, `invalid_input`, `duplicate`… — or `skipped` where nothing runs actions. */
      reason: string;
      /** Said for the caller, by a step that refused with a reason written for them. */
      error?: string;
    };

export type ServerActionOptions = {
  /** The same key twice runs once — a second click, a retry. */
  idempotencyKey?: string;
  /** `none` for an action that only reads: by default a completed run refreshes the page's cached requests. */
  invalidateQueries?: 'all' | 'none';
};

/**
 * Runs one of the space's server actions from a plugin, awaited — what a flow's `runServerAction` step does, with the
 * same access, the same refusals and the same entry in the dev tools:
 *
 * ```ts
 * import type { habitDone } from '../../space/actions'; // `taskAction(tasks.done, …)` or `defineAction(…)`
 *
 * const done = useServerAction<typeof habitDone>('habits-done');
 * const result = await done({ id }); // the input its `call` way in declares; `result.output` what its task returns
 * ```
 *
 * One operation is one action — a contract the server checks before any code runs — never a `case` in one route.
 */
const useServerAction = <Action = unknown, Output = CallOutputOf<Action>>(
  actionId: string
): ((input: CallInputOf<Action>, options?: ServerActionOptions) => Promise<ServerActionResult<Output>>) => {
  const run = use(ServerActionContext);

  return useCallback(
    async (input, options = {}) => {
      if (!run) {
        console.warn(
          `[plitzi] useServerAction: nothing on this page runs server actions, so "${actionId}" was skipped`
        );

        return { ok: false, runId: '', reason: 'skipped' };
      }

      const answer = await run({ actionId, input, ...options });
      if (answer.status !== 'completed') {
        return {
          ok: false,
          runId: answer.runId,
          reason: answer.reason ?? answer.status,
          ...(answer.error ? { error: answer.error } : {})
        };
      }

      // The server's answer is the action's `output`, the contract its declaration states; nothing on this side can
      // check a type against a value, so the declaration's word is taken for it, as any client of an API does.
      return { ok: true, runId: answer.runId, output: answer.output as Output };
    },
    [actionId, run]
  );
};

export default useServerAction;
