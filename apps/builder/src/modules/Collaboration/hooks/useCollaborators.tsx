import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useBuilderStoreSetter } from '@plitzi/sdk-shared/store';
import { RTEvent } from '@plitzi/sdk-shared/websockets';
import { collaboratorTitle } from '@pmodules/Collaboration/CollaborationHelper';
import { createPresenceAnnouncer } from '@pmodules/Collaboration/helpers/presenceAnnouncer';

import type { SubscriptionCollaborator } from '@plitzi/sdk-shared';
import type { PresenceAnnouncement } from '@pmodules/Collaboration/helpers/presenceAnnouncer';
import type { BuilderSubscriptionsContextValue } from '@pmodules/Network/contexts/BuilderSubscriptionsContext';

export type UseCollaboratorsProps = {
  enabled?: boolean;
  instanceId: string;
  registerCallback: BuilderSubscriptionsContextValue['subscriptionsRegisterCallback'];
  unregisterCallback: BuilderSubscriptionsContextValue['subscriptionsUnregisterCallback'];
};

const COLLABORATORS_PATH = 'collaboration.collaborators';

const SAID: Record<PresenceAnnouncement, { person: string; agent: string }> = {
  joined: { person: 'joined', agent: 'is editing this space' },
  left: { person: 'left', agent: 'stopped editing' }
};

/**
 * Keeps `collaboration.collaborators` in sync with the connection: the INIT snapshot plus the join/leave events, and
 * says who joined or left — never a reconnection (`createPresenceAnnouncer`).
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
  const announceRef = useRef<(collaborator: SubscriptionCollaborator, announcement: PresenceAnnouncement) => void>(
    () => undefined
  );
  // One for the builder's life: who it already knows outlives every reconnection, which is what tells a return from a
  // join.
  const [announcer] = useState(() =>
    createPresenceAnnouncer<SubscriptionCollaborator>((collaborator, announcement) =>
      announceRef.current(collaborator, announcement)
    )
  );

  useEffect(() => {
    announceRef.current = (collaborator, announcement) => {
      addToast(
        <div>
          <b>{collaboratorTitle(collaborator)}</b> {SAID[announcement][collaborator.agent ? 'agent' : 'person']}
        </div>,
        { appeareance: 'info', autoDismiss: true, placement: 'top-right' }
      );
    };
  }, [addToast]);

  useEffect(() => () => announcer.dispose(), [announcer]);

  // The snapshot is authoritative and arrives again on every reconnect, so it replaces the list even when it is
  // empty — keeping the previous one left ghost collaborators on screen.
  const resetCollaborators = useCallback(
    (incoming: SubscriptionCollaborator[]) => {
      const others = incoming.filter(collaborator => collaborator.instanceId !== instanceId);
      announcer.present(others);
      setState(COLLABORATORS_PATH, others);
    },
    [announcer, instanceId, setState]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    registerCallback(RTEvent.COLLABORATOR_CONNECTED, (payload: SubscriptionCollaborator) => {
      announcer.connected(payload);
      // Keyed by instanceId: a collaborator that reconnects (or lands on another node) announces itself again
      // and must replace its previous entry instead of showing up twice.
      setState(COLLABORATORS_PATH, state => [...state.filter(item => item.instanceId !== payload.instanceId), payload]);
    });

    registerCallback(RTEvent.COLLABORATOR_DISCONNECTED, (payload: SubscriptionCollaborator) => {
      announcer.disconnected(payload);
      setState(COLLABORATORS_PATH, state => state.filter(item => item.instanceId !== payload.instanceId));
    });

    return () => {
      unregisterCallback(RTEvent.COLLABORATOR_CONNECTED);
      unregisterCallback(RTEvent.COLLABORATOR_DISCONNECTED);
    };
  }, [announcer, enabled, registerCallback, setState, unregisterCallback]);

  return { resetCollaborators };
};

export default useCollaborators;
