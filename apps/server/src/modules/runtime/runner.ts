import { ActionRefusal, isActionRefusal } from '../actions/runtime/errors';
import { changeKv, changeListEntry } from '../actions/runtime/kvChange';
import { requestFromWire, responseOf, wireResponseFrom, wireResponseOf } from '../functions/capabilities';
import { createFunctionsDriver, describeFunctions } from '../functions/driver';
import { FunctionFailure } from '../functions/protocol';

import type { FunctionsDefinition } from '../functions/contract';
import type { FunctionRunner, StreamedRouteAnswer } from '../functions/protocol';

/** A refusal, however it was made: the platform's class, or a bundle's own copy of it — known by its name. */

/**
 * A runtime's functions as a runner: the same protocol as the sandbox's, answered by code loaded in this process. The
 * driver is the sandbox's own (`createFunctionsDriver`), so a task behaves the same in both — its `ctx` is calls to the
 * platform, `ctx.kv.change` the same loop, a refusal the same answer. What it does not share is the isolate: there are
 * no limits here but the platform's clock, since this process is the space's alone — and a route's answer streams.
 *
 * The bundle a request names is not asked for: the code is the one this runtime was started with.
 */
export const createRuntimeRunner = (definition: FunctionsDefinition = {}): FunctionRunner => ({
  describe: () => Promise.resolve(describeFunctions(definition)),
  invoke: async ({ invocation, answer, signal }) => {
    const driver = createFunctionsDriver({
      call: answer,
      signal,
      responseOf: wire => responseOf(wireResponseFrom(wire)),
      requestOf: requestFromWire,
      // A route here answers as it writes — the head at once, its body as the code writes it — so it streams as an
      // endpoint does, with the platform's `ctx`. One with no body is answered whole: there is nothing to wait for.
      wireOfResponse: async response => {
        if (!(response instanceof Response)) {
          return undefined;
        }

        if (!response.body) {
          return wireResponseOf(response);
        }

        return {
          streamed: true,
          status: response.status,
          statusText: response.statusText,
          headers: [...response.headers],
          body: response.body
        } satisfies StreamedRouteAnswer;
      },
      changeKv,
      changeListEntry,
      refusal: message => new ActionRefusal(message)
    });
    try {
      return await driver.invoke(definition, invocation);
    } catch (error) {
      if (isActionRefusal(error)) {
        throw new FunctionFailure('refused', error.message);
      }

      throw error;
    }
  }
});
