import type { GuestBytes } from './bytes';
import type { GuestCrypto } from './crypto';
import type { GuestEvents } from './events';
import type { GuestFetch } from './fetch';
import type { GuestDriver, GuestHost, GuestShared } from './types';

export { guestBytes } from './bytes';
export { guestCrypto } from './crypto';
export { guestEvents } from './events';
export { guestFetch } from './fetch';
export type { GuestDriver, GuestHost, GuestShared } from './types';

/** The web APIs of the guest, each part printed in on its own and handed to the guest built (`isolate.ts`). */
export type GuestParts = { bytes: GuestBytes; events: GuestEvents; fetch: GuestFetch; crypto: GuestCrypto };

/**
 * The runtime a space's code finds in an isolate: the web APIs a bare V8 lacks (`Headers`, `Request`, `Response`,
 * `TextEncoder`, `AbortSignal`, timers, `crypto`) and the `ctx` its functions are handed.
 *
 * It is installed by PRINTING this function into the isolate (`installGuest.toString()`), after the prelude that brings
 * `URL`, `atob`, `structuredClone` and `DOMException` — and after its web APIs, each part printed the same way and
 * handed in built (`parts`). So none of them may use anything from outside its own body — no import, no helper beside
 * it — and all they have of the runner is `host`, the functions in `shared` and the parts before them. Streams are not
 * provided: a body is text or bytes.
 */
export const installGuest = (
  scope: Record<string, unknown>,
  host: GuestHost,
  shared: GuestShared,
  { bytes, events, fetch, crypto }: GuestParts
): GuestDriver => {
  type Answer = { ok: true; value: unknown } | { ok: false; error: string; refused?: true };

  const { isRecord, GuestTextEncoder, GuestTextDecoder } = bytes;
  const {
    GuestEvent,
    GuestEventTarget,
    GuestAbortSignal,
    GuestAbortController,
    guestSetTimeout,
    guestSetInterval,
    clearTimer
  } = events;
  const { GuestHeaders, GuestRequest, GuestResponse, wireOf, headerPairs, bodyOfWire } = fetch;
  const { getRandomValues, randomUUID, subtle } = crypto;

  /**
   * A refusal: what the code threw to tell whoever asked — a wrong password, a full board — rather than a fault. It is
   * `ActionRefusal` from `@plitzi/sdk-server/functions`, known here by its name: the bundle carries its own copy of the
   * class, printed from the platform's (`build.ts`).
   */
  const REFUSAL = 'ActionRefusal';

  const isRefusal = (error: unknown): boolean => error instanceof Error && error.name === REFUSAL;

  const refusal = (message: string, code?: string): Error =>
    Object.assign(new Error(message), { name: REFUSAL }, code === undefined ? {} : { code });

  // ---- the platform, through `host` -----------------------------------------------------------------------------

  const call = async (message: Record<string, unknown>): Promise<unknown> => {
    const answer: unknown = JSON.parse(await host.call(JSON.stringify(message)));
    if (isRecord(answer) && answer.ok === true) {
      return answer.value;
    }

    const said = isRecord(answer) && typeof answer.error === 'string' ? answer.error : 'The platform refused the call';
    // A refusal of the platform's (`ctx.oauth` with nobody connected) is the code's to catch as one, by its code.
    if (isRecord(answer) && answer.refused === true) {
      throw refusal(said, typeof answer.code === 'string' ? answer.code : undefined);
    }

    throw new Error(said);
  };

  const run = new GuestAbortController();

  const driver = shared.createFunctionsDriver({
    call,
    signal: run.signal,
    responseOf: wire =>
      new GuestResponse(bodyOfWire(wire.body), {
        status: typeof wire.status === 'number' ? wire.status : 502,
        statusText: typeof wire.statusText === 'string' ? wire.statusText : '',
        headers: headerPairs(wire.headers)
      }),
    requestOf: wire =>
      new GuestRequest(String(wire.url), {
        method: String(wire.method),
        headers: headerPairs(wire.headers),
        body: wire.method === 'GET' || wire.method === 'HEAD' ? null : bodyOfWire(wire.body),
        signal: run.signal
      }),
    wireOfResponse: response =>
      Promise.resolve(
        response instanceof GuestResponse
          ? {
              status: response.status,
              statusText: response.statusText,
              headers: [...response.headers],
              body: wireOf(response)
            }
          : undefined
      ),
    changeKv: shared.changeKv,
    changeListEntry: shared.changeListEntry,
    refusal
  });

  const { log } = driver;

  const refuseFetch = (): Promise<never> =>
    Promise.reject(
      new TypeError('Functions reach the network through ctx.fetch, which knows the hosts they may reach')
    );

  Object.assign(scope, {
    TextEncoder: GuestTextEncoder,
    TextDecoder: GuestTextDecoder,
    Event: GuestEvent,
    EventTarget: GuestEventTarget,
    AbortSignal: GuestAbortSignal,
    AbortController: GuestAbortController,
    Headers: GuestHeaders,
    Request: GuestRequest,
    Response: GuestResponse,
    setTimeout: guestSetTimeout,
    clearTimeout: clearTimer,
    setInterval: guestSetInterval,
    clearInterval: clearTimer,
    queueMicrotask: (callback: () => void) => {
      void Promise.resolve().then(callback);
    },
    crypto: { getRandomValues, randomUUID, subtle },
    console: { log, info: log, warn: log, error: log, debug: log },
    fetch: refuseFetch
  });

  // ---- the driver -----------------------------------------------------------------------------------------------

  const describe = (definition: unknown): string =>
    JSON.stringify({ ok: true, value: shared.describeFunctions(definition) });

  return {
    describe,
    invoke: async (definition, invocationText) => {
      let answer: Answer;
      try {
        const invocation: unknown = JSON.parse(invocationText);
        answer = { ok: true, value: await driver.invoke(definition, isRecord(invocation) ? invocation : {}) };
      } catch (error) {
        answer = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          ...(isRefusal(error) ? { refused: true as const } : {})
        };
      }

      try {
        return JSON.stringify(answer);
      } catch (error) {
        return JSON.stringify({
          ok: false,
          error: `What the function answered is not JSON: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    },
    abort: reason => {
      run.abort(new DOMException(reason, 'AbortError'));
    }
  };
};
