import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, useEffect, useState } from 'react';

import { RTEvent } from '@plitzi/sdk-shared/websockets/RTCodec';

import type { SubscriptionCollaborator } from '@plitzi/sdk-shared';
import type { BuilderSubscriptionsContextValue } from '@pmodules/Network/contexts/BuilderSubscriptionsContext';

export type UseCollaboratorsProps = {
  enabled?: boolean;
  instanceId: string;
  registerCallback: BuilderSubscriptionsContextValue['subscriptionsRegisterCallback'];
  unregisterCallback: BuilderSubscriptionsContextValue['subscriptionsUnregisterCallback'];
};

/** Who else is in this space right now: the INIT snapshot plus the join/leave events that keep it current. */
const useCollaborators = ({
  enabled = true,
  instanceId,
  registerCallback,
  unregisterCallback
}: UseCollaboratorsProps) => {
  const { addToast } = useToast();
  const [collaborators, setCollaborators] = useState<SubscriptionCollaborator[]>([]);

  // The snapshot is authoritative and arrives again on every reconnect, so it replaces the list even when it is
  // empty — keeping the previous one left ghost collaborators on screen.
  const resetCollaborators = useCallback(
    (incoming: SubscriptionCollaborator[]) =>
      setCollaborators(incoming.filter(collaborator => collaborator.instanceId !== instanceId)),
    [instanceId]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    registerCallback(RTEvent.COLLABORATOR_CONNECTED, (payload: SubscriptionCollaborator) => {
      const {
        user: { firstName, surName }
      } = payload;
      addToast(
        <div>
          Collaborator <b>{`${firstName} ${surName}`}</b> Joined into the WorkSpace
        </div>,
        { appeareance: 'info', autoDismiss: true, placement: 'top-right' }
      );

      // Keyed by instanceId: a collaborator that reconnects (or lands on another node) announces itself again
      // and must replace its previous entry instead of showing up twice.
      setCollaborators(state => [...state.filter(item => item.instanceId !== payload.instanceId), payload]);
    });

    registerCallback(RTEvent.COLLABORATOR_DISCONNECTED, (payload: SubscriptionCollaborator) => {
      const {
        user: { firstName, surName }
      } = payload;
      addToast(
        <div>
          Collaborator <b>{`${firstName} ${surName}`}</b> Left the WorkSpace
        </div>,
        { appeareance: 'info', autoDismiss: true, placement: 'top-right' }
      );

      setCollaborators(state => state.filter(item => item.instanceId !== payload.instanceId));
    });

    return () => {
      unregisterCallback(RTEvent.COLLABORATOR_CONNECTED);
      unregisterCallback(RTEvent.COLLABORATOR_DISCONNECTED);
    };
  }, [addToast, enabled, registerCallback, unregisterCallback]);

  return { collaborators, resetCollaborators };
};

export default useCollaborators;
