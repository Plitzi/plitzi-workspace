import { ActionRefusal, isActionRefusal } from '@plitzi/sdk-shared/functions';
import { changeKv, changeListEntry } from '@plitzi/sdk-shared/functions';
import { FunctionFailure } from '@plitzi/sdk-shared/functions';
import { requestFromWire, responseOf, wireResponseFrom, wireResponseOf } from '@plitzi/sdk-shared/functions';

import { createFunctionsDriver, describeFunctions } from '../runner/driver';

import type { FunctionsDefinition } from '@plitzi/sdk-shared/functions';
import type { FunctionRunner, StreamedRouteAnswer } from '@plitzi/sdk-shared/functions';

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
  invoke: async ({ invocation, answer, signal, onUsage }) => {
    const startedAt = Date.now();
    let calls = 0;
    const counted = (call: unknown): Promise<unknown> => {
      calls += 1;

      return answer(call);
    };
    const driver = createFunctionsDriver({
      call: counted,
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
    // Aborted, the invocation ends whatever the code waits on: what the platform stopped is not waited for here either.
    let stop: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      stop = () => {
        reject(new FunctionFailure('aborted', typeof signal.reason === 'string' ? signal.reason : 'Aborted'));
      };
      if (signal.aborted) {
        stop();
      } else {
        signal.addEventListener('abort', stop, { once: true });
      }
    });
    try {
      return await Promise.race([driver.invoke(definition, invocation), aborted]);
    } catch (error) {
      if (error instanceof FunctionFailure) {
        throw error;
      }

      if (isActionRefusal(error)) {
        throw new FunctionFailure('refused', error.message);
      }

      // Every way it fails is one of the protocol's: the code's own error is `error`, with its words.
      throw new FunctionFailure('error', error instanceof Error ? error.message : String(error));
    } finally {
      if (stop) {
        signal.removeEventListener('abort', stop);
      }

      // A runtime is the space's whole process, sized and paid as one: an invocation is charged no CPU of its own.
      onUsage?.({ cpuMs: 0, wallMs: Date.now() - startedAt, calls });
    }
  }
});
