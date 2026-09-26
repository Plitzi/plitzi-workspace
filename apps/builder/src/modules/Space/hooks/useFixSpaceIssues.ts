import { useToast } from '@plitzi/plitzi-ui/Toast';
import { use, useCallback } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import useSpaceIssues from './useSpaceIssues';

import type { BuilderMutationsMap, BuilderQueriesMap } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

/**
 * Asks the server to fix every issue of the saved space that has one reading, and puts the result on screen.
 *
 * The fix is made where the document lives, so it is held to the same integrity as every save and reaches the other
 * editors as a schema update. Here the returned schema is applied as a change that already happened on the server —
 * from subscriptions — so the save queue does not send it straight back. Resolves with the changes made.
 */
const useFixSpaceIssues = () => {
  const { mutate } = use(NetworkContext) as BuilderNetworkContextValue<BuilderQueriesMap, BuilderMutationsMap>;
  const { eventBridge } = use(EventBridgeContext);
  const { addToast } = useToast();
  const { refresh } = useSpaceIssues();

  return useCallback(async () => {
    const response = await mutate('SpaceFixIssues', {});
    if (!response.result) {
      return [];
    }

    const { applied, schema } = response.result;
    if (applied.length > 0) {
      await eventBridge.emit('main', 'schemaUpdate', schema, true);
    }

    await refresh();
    addToast(applied.length > 0 ? `Fixed ${applied.length} issues.` : 'Nothing was left to fix.', {
      appeareance: applied.length > 0 ? 'success' : 'info',
      autoDismiss: true,
      placement: 'top-right'
    });

    return applied;
  }, [addToast, eventBridge, mutate, refresh]);
};

export default useFixSpaceIssues;
