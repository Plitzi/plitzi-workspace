import { useCallback, use, useMemo } from 'react';

import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import InteractionsContext from '../../InteractionsContext';

import type { ActionCallMode, InteractionCallback, InteractionCallbackContext } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type ActionInteractionsProps = {
  children?: ReactNode;
};

type RunParams = {
  actionId: string;
  /** Authored as JSON text, and arriving as an object whenever the flow engine already parsed it — see below. */
  input: string | Record<string, unknown>;
  mode: ActionCallMode;
  idempotencyKey: string;
};

type ActionResponse = {
  runId?: string;
  status?: string;
  output?: Record<string, unknown>;
  error?: string;
  reason?: string;
};

type StreamFrame = { event: string; data: Record<string, unknown> };

/**
 * Reads an SSE body frame by frame.
 *
 * Hand-parsed rather than delegated to `EventSource` for the reason above, and buffered because a frame can arrive
 * split across chunks — reading each chunk as a whole message is the bug that shows up only under a slow network.
 */
const readStream = async (body: ReadableStream<Uint8Array>, onFrame: (frame: StreamFrame) => void) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const event = /event: (\w+)/.exec(block)?.[1];
      const data = /data: (.*)/.exec(block)?.[1];
      if (!event) {
        // A comment frame — the server's heartbeat. It carries nothing and exists to notice a dead peer.
        continue;
      }

      try {
        onFrame({ event, data: data ? (JSON.parse(data) as Record<string, unknown>) : {} });
      } catch {
        // A frame that does not parse is dropped rather than ending the stream: the run is still going.
      }
    }
  }
};

/**
 * The step's `input`, however the engine happened to hand it over.
 *
 * It is authored as JSON text, but a param carrying twig is resolved before this callback sees it and the resolver
 * returns the RESULT's own type — so an input with a binding in it (`{"city": "{{form.values.city}}"}`) arrives
 * already parsed, while one with no token at all arrives as the string it was written as. Accepting only the
 * string was a bound input silently posting nothing: the common case, and the one that looks like the server
 * dropping the values.
 */
const parseInput = (input: string | Record<string, unknown>): Record<string, unknown> => {
  if (!input) {
    return {};
  }

  if (typeof input === 'object') {
    return input;
  }

  try {
    const parsed: unknown = JSON.parse(input);

    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/**
 * What a step answers when the request never reached a server at all.
 *
 * The same SHAPE the server's own refusal produces, on purpose: to a flow, "the server said no" and "there was no
 * server to ask" are the same event — the run did not happen — and an author binding `{{step.status}}` should not
 * have to discover that one of them arrives as a result and the other as a thrown error. The message is where the
 * two are told apart, because that is a question for whoever is debugging, not for the flow.
 */
const unreachable = { status: 'failed', reason: 'failed', runId: '', output: {} };

/**
 * Running a server action from a client flow.
 *
 * The step names an action and hands it inputs — never a URL, a connector or a credential. Which one it can reach
 * is the server's to decide from the space's own documents, so a page can only ever run what that space already
 * declared.
 */
const ActionInteractions = ({ children }: ActionInteractionsProps) => {
  const { useInteractions, interactionsManager } = use(InteractionsContext);
  const [endpoint] = useCommonStore('actions.endpoint');

  /**
   * Reports a detached run back to the element that launched it.
   *
   * A detached step returns the moment the request is accepted, so the flow that started it is long gone by the
   * time the server answers. Firing on the LAUNCHING element is what gives an author somewhere to say "when this
   * button's action finishes, show the toast" — and a refusal fires too, with the server's own reason, because a
   * guard nobody can observe is a guard they will work around.
   */
  const reportFlow = useCallback(
    (
      elementRef: string | undefined,
      event: 'onFlowEnd' | 'onFlowError' | 'onFlowProgress',
      params: Record<string, unknown>
    ) => {
      if (!elementRef) {
        return;
      }

      void (
        interactionsManager as { interactionTrigger: (id: string, name: string, params: object) => unknown }
      ).interactionTrigger(elementRef, event, params);
    },
    [interactionsManager]
  );

  const handleRunAction = useCallback(
    async (params: RunParams, context?: InteractionCallbackContext) => {
      const { actionId, mode = 'await', idempotencyKey } = params;
      if (!endpoint) {
        // Said once, plainly: the step is not broken, this render simply has no server tier to run it on. A silent
        // no-op here is a button that does nothing for a reason nobody can see.
        pConsole.warning(
          'interactions',
          <span>
            Server action <b>{actionId}</b> was skipped: this page is served without a Plitzi server
          </span>,
          { actionId }
        );

        return { status: 'skipped', runId: '', output: {} };
      }

      if (!actionId) {
        return { status: 'skipped', runId: '', output: {} };
      }

      const body = JSON.stringify({
        actionId,
        input: parseInput(params.input),
        ...(idempotencyKey ? { idempotencyKey } : {})
      });

      if (mode === 'detached') {
        // Announced as it starts, not only when it fails. A detached run is invisible by construction — the flow
        // returned, the page moved on — so without this the honest answer to "did anything happen?" is a network
        // tab. It lands in the dev-tools log beside the client flows, which is where an author already looks.
        pConsole.info(
          'interactions',
          <span>
            Server action <b>{actionId}</b> sent
          </span>,
          { actionId, mode }
        );

        // `keepalive` so a navigation right after "Send" does not kill the request: the flow is not waiting for
        // the answer, which is exactly when the page is most likely to move on. It caps the body at ~64KB, which
        // is a limit on INPUTS and generous for them.
        void fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          keepalive: true,
          body
        })
          .then(async response => {
            const payload = (await response.json().catch(() => ({}))) as ActionResponse;
            if (!response.ok) {
              reportFlow(context?.elementRef, 'onFlowError', {
                actionId,
                runId: payload.runId ?? '',
                error: payload.error ?? '',
                reason: payload.reason ?? 'failed'
              });

              return;
            }

            pConsole.success(
              'interactions',
              <span>
                Server action <b>{actionId}</b> finished
              </span>,
              { actionId, runId: payload.runId, status: payload.status, output: payload.output }
            );
            reportFlow(context?.elementRef, 'onFlowEnd', {
              actionId,
              runId: payload.runId ?? '',
              status: payload.status ?? 'completed',
              output: payload.output ?? {}
            });
          })
          .catch((error: unknown) => {
            pConsole.warning(
              'interactions',
              <span>
                Server action <b>{actionId}</b> could not be sent
              </span>,
              { actionId, error: error instanceof Error ? error.message : String(error) }
            );
            reportFlow(context?.elementRef, 'onFlowError', { actionId, runId: '', error: '', reason: 'failed' });
          });

        return { accepted: true, status: 'accepted', runId: '', output: {} };
      }

      if (mode === 'stream') {
        pConsole.info(
          'interactions',
          <span>
            Server action <b>{actionId}</b> streaming
          </span>,
          { actionId, mode }
        );

        // `fetch` + a reader, never `EventSource`: that reconnects whenever a stream ends — success included — and
        // each reconnect would start another run of the same action, forever.
        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            credentials: 'same-origin',
            body
          });
        } catch (error: unknown) {
          pConsole.warning(
            'interactions',
            <span>
              Server action <b>{actionId}</b> could not be reached
            </span>,
            { actionId, error: error instanceof Error ? error.message : String(error) }
          );
          reportFlow(context?.elementRef, 'onFlowError', { actionId, runId: '', error: '', reason: 'failed' });

          return unreachable;
        }

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => ({}))) as ActionResponse;
          reportFlow(context?.elementRef, 'onFlowError', {
            actionId,
            runId: payload.runId ?? '',
            error: payload.error ?? '',
            reason: payload.reason ?? 'failed'
          });

          return { status: 'failed', reason: payload.reason ?? 'failed', runId: '', output: {} };
        }

        // Frames are consumed in the background: the STEP returns as soon as the stream opens, so the flow carries
        // on and the page hears about progress through its triggers.
        void readStream(response.body, frame => {
          if (frame.event === 'data') {
            reportFlow(context?.elementRef, 'onFlowProgress', { actionId, ...frame.data });

            return;
          }

          if (frame.event === 'error') {
            reportFlow(context?.elementRef, 'onFlowError', { actionId, ...frame.data });

            return;
          }

          if (frame.event === 'done') {
            reportFlow(context?.elementRef, 'onFlowEnd', { actionId, ...frame.data });
          }
        });

        return { accepted: true, status: 'streaming', runId: '', output: {} };
      }

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body
        });
      } catch (error: unknown) {
        // A server that is down, a connection that dropped, a page kept open through a deploy. Reported like a
        // refusal rather than thrown, so the rest of the flow — and the element that fired it — hear about it.
        pConsole.warning(
          'interactions',
          <span>
            Server action <b>{actionId}</b> could not be reached
          </span>,
          { actionId, error: error instanceof Error ? error.message : String(error) }
        );
        reportFlow(context?.elementRef, 'onFlowError', { actionId, runId: '', error: '', reason: 'failed' });

        return unreachable;
      }

      const payload = (await response.json().catch(() => ({}))) as ActionResponse;
      if (!response.ok) {
        // The reason is the server's own vocabulary — `duplicate`, `over_capacity`, `recursion` — and naming it is
        // what lets an author tell "my flow is wrong" from "I clicked twice".
        pConsole.warning(
          'interactions',
          <span>
            Server action <b>{actionId}</b> was refused
          </span>,
          { actionId, reason: payload.reason, error: payload.error, status: response.status }
        );

        return { status: 'failed', reason: payload.reason ?? 'failed', runId: payload.runId ?? '', output: {} };
      }

      return {
        status: payload.status ?? 'completed',
        runId: payload.runId ?? '',
        output: payload.output ?? {}
      };
    },
    [endpoint, reportFlow]
  );

  /**
   * Stops a run this page started.
   *
   * The socket closing already aborts an awaited run, so this is for what that cannot cover: a `detached` or
   * `stream` run the visitor wants to call off, and a run started in another tab. The server checks that the
   * caller owns it — a run id travels to the browser, and holding one must not let anybody stop somebody else's.
   */
  const handleCancelAction = useCallback(
    async (params: { runId: string }) => {
      if (!endpoint || !params.runId) {
        return { cancelled: false };
      }

      try {
        const response = await fetch(`${endpoint}/run/${params.runId}`, {
          method: 'DELETE',
          credentials: 'same-origin'
        });

        return { cancelled: response.status === 204 };
      } catch {
        // Unreachable is not cancelled, and it is not an exception either: the caller asked whether the run was
        // stopped, and the honest answer to that is no.
        return { cancelled: false };
      }
    },
    [endpoint]
  );

  const interactionCallbacks = useMemo(
    (): Record<string, InteractionCallback> => ({
      cancelServerAction: {
        action: 'cancelServerAction',
        title: 'Cancel Server Action',
        type: 'globalCallback',
        callback: handleCancelAction as InteractionCallback['callback'],
        preview: { cancelled: '' },
        params: {
          runId: { type: 'text', canBind: true, defaultValue: '', label: 'Run id' }
        }
      },
      runServerAction: {
        action: 'runServerAction',
        title: 'Run Server Action',
        type: 'globalCallback',
        callback: handleRunAction as InteractionCallback['callback'],
        preview: { runId: '', status: '', output: {} },
        params: {
          actionId: { type: 'text', canBind: true, defaultValue: '', label: 'Action' },
          input: { type: 'codemirror-json', canBind: true, defaultValue: '{}', label: 'Input' },
          mode: {
            type: 'select',
            defaultValue: 'await',
            label: 'Mode',
            options: [
              { label: 'Wait for the result', value: 'await' },
              { label: 'Send and continue', value: 'detached' },
              { label: 'Stream progress', value: 'stream' }
            ]
          },
          // Only meaningful when the flow waits: a detached step never sees the refusal a repeated key produces.
          idempotencyKey: {
            type: 'text',
            canBind: true,
            defaultValue: '',
            label: 'Idempotency Key',
            when: params => params.mode !== 'detached'
          }
        }
      }
    }),
    [handleRunAction, handleCancelAction]
  );

  useInteractions({ id: 'actions', callbacks: interactionCallbacks });

  return children;
};

export default ActionInteractions;
