import { useCallback } from 'react';

/** Values a write callback receives from the interaction step, minus the keys the endpoint reads itself. */
type WriteParams = Record<string, unknown> & { recordId?: string };

export type UseProviderWriteProps = {
  elementId: string;
  enabled: boolean;
  actionPath?: string;
  onDone?: () => Promise<void> | void;
};

/**
 * Write callbacks for a server-driven provider.
 *
 * The browser posts an **element id and an action** — never a URL, a connector or a credential. The server resolves
 * the target from the published schema and refuses anything the connector has not declared, so a form can only ever
 * reach the backend its own page is already wired to.
 */
const useProviderWrite = ({ elementId, enabled, actionPath = '/_action', onDone }: UseProviderWriteProps) => {
  const submit = useCallback(
    async (action: 'create' | 'update' | 'delete', params: WriteParams = {}) => {
      if (!enabled) {
        return undefined;
      }

      const { recordId, ...values } = params;
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

  const createRecord = useCallback((params?: WriteParams) => submit('create', params), [submit]);
  const updateRecord = useCallback((params?: WriteParams) => submit('update', params), [submit]);
  const removeRecord = useCallback((params?: WriteParams) => submit('delete', params), [submit]);

  return { createRecord, updateRecord, removeRecord };
};

export default useProviderWrite;
