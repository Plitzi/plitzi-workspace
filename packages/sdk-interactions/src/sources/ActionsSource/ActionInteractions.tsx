import { useCallback, use, useMemo } from 'react';

import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import InteractionsContext from '../../InteractionsContext';

import type { ActionCallMode, InteractionCallback } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type ActionInteractionsProps = {
  children?: ReactNode;
};

type RunParams = {
  actionId: string;
  input: string;
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

const parseInput = (input: string): Record<string, unknown> => {
  if (!input) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(input);

    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/**
 * Running a server action from a client flow.
 *
 * The step names an action and hands it inputs — never a URL, a connector or a credential. Which one it can reach
 * is the server's to decide from the space's own documents, so a page can only ever run what that space already
 * declared.
 */
const ActionInteractions = ({ children }: ActionInteractionsProps) => {
  const { useInteractions } = use(InteractionsContext);
  const [endpoint] = useCommonStore('actions.endpoint');

  const handleRunAction = useCallback(
    async (params: RunParams) => {
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
        // `keepalive` so a navigation right after "Send" does not kill the request: the flow is not waiting for
        // the answer, which is exactly when the page is most likely to move on. It caps the body at ~64KB, which
        // is a limit on INPUTS and generous for them.
        void fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          keepalive: true,
          body
        }).catch((error: unknown) => {
          pConsole.warning(
            'interactions',
            <span>
              Server action <b>{actionId}</b> could not be sent
            </span>,
            { actionId, error: error instanceof Error ? error.message : String(error) }
          );
        });

        return { accepted: true, status: 'accepted', runId: '', output: {} };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body
      });
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
    [endpoint]
  );

  const interactionCallbacks = useMemo(
    (): Record<string, InteractionCallback> => ({
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
              { label: 'Send and continue', value: 'detached' }
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
    [handleRunAction]
  );

  useInteractions({ id: 'actions', callbacks: interactionCallbacks });

  return children;
};

export default ActionInteractions;
