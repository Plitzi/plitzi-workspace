import { useToast } from '@plitzi/plitzi-ui/Toast';
import omit from 'lodash-es/omit';
import set from 'lodash-es/set';
import { useCallback, use, useMemo, useState, useEffect } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { isRTEvent, RTEvent } from '@plitzi/sdk-shared/websockets/RTCodec';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import useWebsocket from '@pmodules/Network/hooks/useWebsocket';

import type { SubscriptionCollaborator } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { RTCallback, RTMessageManagedServer } from '@plitzi/sdk-shared/websockets/RTCodec';
import type { ReactNode } from 'react';

export type NetworkSubscriptionsContextProviderProps = {
  children: ReactNode;
  includeSubscriptions?: boolean;
  includeRealTime?: boolean;
};

const NetworkSubscriptionsContextProvider = ({
  children,
  includeRealTime = true,
  includeSubscriptions = true
}: NetworkSubscriptionsContextProviderProps) => {
  const { addToast } = useToast();
  const [messageCallbacks, setMessageCallbacks] = useState<Partial<Record<RTEvent, Record<string, RTCallback>>>>({});
  const [collaborators, setCollaborators] = useState<SubscriptionCollaborator[]>([]);
  const { webKey, instanceId, server, userKey } = use(NetworkContext) as BuilderNetworkContextValue;

  const processMessage = useCallback(
    (data: RTMessageManagedServer) => {
      if (data.type === RTEvent.INIT) {
        // Init Realtime
        const collaborators = data.payload.collaborators.filter(collaborator => collaborator.instanceId !== instanceId);
        if (collaborators.length > 0) {
          setCollaborators(collaborators);
        }

        return;
      }

      if (!isRTEvent(data.type)) {
        // Invalid Packet
        return;
      }

      const callbacks = messageCallbacks[data.type];
      if (!callbacks || !data.payload || data.payload.instanceId === instanceId) {
        return;
      }

      Object.keys(callbacks).forEach(callbackKey => callbacks[callbackKey](data.payload));
    },
    [instanceId, messageCallbacks]
  );

  const { push } = useWebsocket({
    isBinary: true,
    url: `${server.websocketServer}?instanceId=${instanceId}&token=${webKey}&userToken=${userKey}`,
    protocols: ['realtime-ws'],
    processMessage,
    connectMode: includeRealTime ? 'auto' : 'manual'
  });

  const registerCallback = useCallback(
    (type: RTEvent, callback: RTCallback) => {
      setMessageCallbacks(state => set(state, `${type}.${instanceId}`, callback));
    },
    [instanceId]
  );

  const unregisterCallback = useCallback(
    (type: RTEvent) => {
      setMessageCallbacks(
        state => omit(state, [`${type}.${instanceId}`]) as Record<RTEvent, Record<string, RTCallback>>
      );
    },
    [instanceId]
  );

  useEffect(() => {
    if (includeSubscriptions) {
      registerCallback(
        RTEvent.COLLABORATOR_CONNECTED,
        (payload: Extract<RTMessageManagedServer, { type: RTEvent.COLLABORATOR_CONNECTED }>['payload']) => {
          const {
            user: { firstName, surName }
          } = payload;
          addToast(
            <div>
              Collaborator <b>{`${firstName} ${surName}`}</b> Joined into the WorkSpace
            </div>,
            { appeareance: 'info', autoDismiss: true, placement: 'top-right' }
          );

          setCollaborators(state => [...state, payload]);
        }
      );

      registerCallback(
        RTEvent.COLLABORATOR_DISCONNECTED,
        (payload: Extract<RTMessageManagedServer, { type: RTEvent.COLLABORATOR_DISCONNECTED }>['payload']) => {
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
        }
      );
    }

    return () => {
      if (includeSubscriptions) {
        unregisterCallback(RTEvent.COLLABORATOR_CONNECTED);
        unregisterCallback(RTEvent.COLLABORATOR_DISCONNECTED);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeSubscriptions]);

  const subscriptionsValue = useMemo(
    () => ({
      includeSubscriptions,
      supportRealTime: includeRealTime,
      subscriptionsPush: push,
      subscriptionsRegisterCallback: registerCallback,
      subscriptionsUnregisterCallback: unregisterCallback,
      subscriptionsCollaborators: collaborators
    }),
    [includeSubscriptions, includeRealTime, push, registerCallback, unregisterCallback, collaborators]
  );

  return <BuilderSubscriptionsContext value={subscriptionsValue}>{children}</BuilderSubscriptionsContext>;
};

export default NetworkSubscriptionsContextProvider;
