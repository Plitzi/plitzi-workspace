import { useCallback } from 'react';

/** Values a write callback receives from the interaction step, minus the keys the endpoint reads itself. */
type WriteParams = Record<string, unknown> & { action?: unknown; recordId?: string };

export type UseProviderWriteProps = {
  elementId: string;
  enabled: boolean;
  actionPath?: string;
  onDone?: () => Promise<void> | void;
};

/**
 * Write callbacks for a server-driven provider.
 *
 * The browser posts an **element id and an action name** — never a URL, a connector or a credential. The server
 * resolves the target from the published schema and refuses anything the connector has not declared, so a form can
 * only ever reach the backend its own page is already wired to.
 *
 * There is one callback rather than one per CRUD verb because a connector's write endpoints are named by whoever
 * wrote the manifest: `escalate` and `sendInvoice` are as legitimate as `create`, and three fixed verbs would only
 * be able to reach a connector that happened to use them.
 */
const useProviderWrite = ({ elementId, enabled, actionPath = '/_action', onDone }: UseProviderWriteProps) => {
  const writeRecord = useCallback(
    async (params: WriteParams = {}) => {
      const { action, recordId, ...values } = params;
      if (!enabled || typeof action !== 'string' || !action) {
        return undefined;
      }

      const response = await fetch(actionPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ elementId, action, recordId, values })
      });
      if (!response.ok) {
        throw new Error(`Write failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { record: unknown };
      await onDone?.();

      return payload.record;
    },
    [actionPath, elementId, enabled, onDone]
  );

  return { writeRecord };
};

export default useProviderWrite;
