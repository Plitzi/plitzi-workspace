import { ActionRefusal } from '../actions/runtime/errors';
import { changeKv } from '../actions/runtime/kvChange';
import { requestFromWire, responseOf, wireResponseFrom, wireResponseOf } from '../functions/capabilities';
import { createFunctionsDriver, describeFunctions } from '../functions/driver';
import { FunctionFailure } from '../functions/protocol';

import type { FunctionsDefinition } from '../functions/contract';
import type { FunctionRunner } from '../functions/protocol';

/** A refusal, however it was made: the platform's class, or a bundle's own copy of it — known by its name. */
const isRefusal = (error: unknown): error is Error => error instanceof Error && error.name === 'ActionRefusal';

/**
 * A runtime's functions as a runner: the same protocol as the sandbox's, answered by code loaded in this process. The
 * driver is the sandbox's own (`createFunctionsDriver`), so a task behaves the same in both — its `ctx` is calls to the
 * platform, `ctx.kv.change` the same loop, a refusal the same answer. What it does not share is the isolate: there are
 * no limits here but the platform's clock, since this process is the space's alone.
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
      wireOfResponse: async response => (response instanceof Response ? wireResponseOf(response) : undefined),
      changeKv,
      refusal: message => new ActionRefusal(message)
    });
    try {
      return await driver.invoke(definition, invocation);
    } catch (error) {
      if (isRefusal(error)) {
        throw new FunctionFailure('refused', error.message);
      }

      throw error;
    }
  }
});
