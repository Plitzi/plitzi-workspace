import { useCallback, use, useMemo, useRef } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { isRTEvent, RTEvent } from '@plitzi/sdk-shared/websockets/RTCodec';
import useCollaborators from '@pmodules/Collaboration/hooks/useCollaborators';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import useWebsocket from '@pmodules/Network/hooks/useWebsocket';

import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { RTCallback, RTMessageManagedServer } from '@plitzi/sdk-shared/websockets/RTCodec';
import type { ReactNode } from 'react';

export type NetworkSubscriptionsContextProviderProps = {
  children: ReactNode;
  includeSubscriptions?: boolean;
  includeRealTime?: boolean;
};

/**
 * The realtime transport: one socket, and the fan-out of its messages to whoever registered for them. What the
 * messages MEAN belongs to the Collaboration module.
 */
const NetworkSubscriptionsContextProvider = ({
  children,
  includeRealTime = true,
  includeSubscriptions = true
}: NetworkSubscriptionsContextProviderProps) => {
  // A plain map, not state: registering a listener is not a render input, and several listeners per event
  // (one collaborator area each) have to coexist without re-rendering the tree that holds them.
  const callbacksRef = useRef(new Map<RTEvent, Map<string, RTCallback>>());
  const { webKey, instanceId, server, userKey } = use(NetworkContext) as BuilderNetworkContextValue;

  const registerCallback = useCallback(
    (type: RTEvent, callback: RTCallback, subscriberId: string = instanceId) => {
      const callbacks = callbacksRef.current.get(type) ?? new Map<string, RTCallback>();
      callbacks.set(subscriberId, callback);
      callbacksRef.current.set(type, callbacks);
    },
    [instanceId]
  );

  const unregisterCallback = useCallback(
    (type: RTEvent, subscriberId: string = instanceId) => {
      callbacksRef.current.get(type)?.delete(subscriberId);
    },
    [instanceId]
  );

  const { collaborators, resetCollaborators } = useCollaborators({
    enabled: includeSubscriptions,
    instanceId,
    registerCallback,
    unregisterCallback
  });

  const processMessage = useCallback(
    (data: RTMessageManagedServer) => {
      if (data.type === RTEvent.INIT) {
        resetCollaborators(data.payload.collaborators);

        return;
      }

      if (!isRTEvent(data.type)) {
        // Invalid Packet
        return;
      }

      const callbacks = callbacksRef.current.get(data.type);
      if (!callbacks || !data.payload || data.payload.instanceId === instanceId) {
        return;
      }

      callbacks.forEach(callback => callback(data.payload));
    },
    [instanceId, resetCollaborators]
  );

  const { push } = useWebsocket({
    isBinary: true,
    url: `${server.websocketServer}?instanceId=${instanceId}&token=${webKey}&userToken=${userKey}`,
    protocols: ['realtime-ws'],
    processMessage,
    connectMode: includeRealTime ? 'auto' : 'manual'
  });

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
