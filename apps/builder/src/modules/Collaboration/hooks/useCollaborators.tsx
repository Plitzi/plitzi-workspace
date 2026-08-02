import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, useEffect } from 'react';

import { useBuilderStoreSetter } from '@plitzi/sdk-shared/store';
import { RTEvent } from '@plitzi/sdk-shared/websockets/RTCodec';

import type { SubscriptionCollaborator } from '@plitzi/sdk-shared';
import type { BuilderSubscriptionsContextValue } from '@pmodules/Network/contexts/BuilderSubscriptionsContext';

export type UseCollaboratorsProps = {
  enabled?: boolean;
  instanceId: string;
  registerCallback: BuilderSubscriptionsContextValue['subscriptionsRegisterCallback'];
  unregisterCallback: BuilderSubscriptionsContextValue['subscriptionsUnregisterCallback'];
};

const COLLABORATORS_PATH = 'collaboration.collaborators';

/**
 * Keeps `collaboration.collaborators` in sync with the connection: the INIT snapshot plus the join/leave events.
 * It writes to the store and reads nothing back, so presence changes never re-render the transport that carries
 * them — and every surface that wants presence reads the store instead of being handed it.
 */
const useCollaborators = ({
  enabled = true,
  instanceId,
  registerCallback,
  unregisterCallback
}: UseCollaboratorsProps) => {
  const { addToast } = useToast();
  const setState = useBuilderStoreSetter();

  // The snapshot is authoritative and arrives again on every reconnect, so it replaces the list even when it is
  // empty — keeping the previous one left ghost collaborators on screen.
  const resetCollaborators = useCallback(
    (incoming: SubscriptionCollaborator[]) =>
      setState(
        COLLABORATORS_PATH,
        incoming.filter(collaborator => collaborator.instanceId !== instanceId)
      ),
    [instanceId, setState]
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
      setState(COLLABORATORS_PATH, state => [...state.filter(item => item.instanceId !== payload.instanceId), payload]);
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

      setState(COLLABORATORS_PATH, state => state.filter(item => item.instanceId !== payload.instanceId));
    });

    return () => {
      unregisterCallback(RTEvent.COLLABORATOR_CONNECTED);
      unregisterCallback(RTEvent.COLLABORATOR_DISCONNECTED);
    };
  }, [addToast, enabled, registerCallback, setState, unregisterCallback]);

  return { resetCollaborators };
};

export default useCollaborators;
