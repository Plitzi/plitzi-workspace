import { useToast } from '@plitzi/plitzi-ui/Toast';
import omit from 'lodash-es/omit';
import set from 'lodash-es/set';
import { useCallback, use, useLayoutEffect, useMemo, useState } from 'react';

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
  const [messageCallbacks, setMessageCallbacks] = useState<Record<RTEvent, Record<string, RTCallback>>>(
    {} as Record<RTEvent, Record<string, RTCallback>>
  );
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

      if (
        !(messageCallbacks[data.type] as Record<string, RTCallback> | undefined) ||
        !data.payload ||
        data.payload.instanceId === instanceId
      ) {
        return;
      }

      Object.keys(messageCallbacks[data.type])
        .filter(callbackKey => callbackKey !== instanceId) // || isRealTimeSelfEvent(type) @todo: review
        .forEach(callbackKey => messageCallbacks[data.type][callbackKey](data.payload));
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

  const registerCallback = useCallback((key: string, type: RTEvent, callback: RTCallback) => {
    if (key) {
      setMessageCallbacks(state => set(state, `${type}.${key}`, callback));
    }
  }, []);

  const unregisterCallback = useCallback((key: string, type: RTEvent) => {
    if (key) {
      setMessageCallbacks(state => omit(state, [`${type}.${key}`]) as Record<RTEvent, Record<string, RTCallback>>);
    }
  }, []);

  useLayoutEffect(() => {
    if (includeSubscriptions) {
      registerCallback(instanceId, RTEvent.COLLABORATOR_CONNECTED, (payload: SubscriptionCollaborator) => {
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
      });

      registerCallback(instanceId, RTEvent.COLLABORATOR_DISCONNECTED, (payload: SubscriptionCollaborator) => {
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
    }

    return () => {
      if (includeSubscriptions) {
        unregisterCallback(instanceId, RTEvent.COLLABORATOR_CONNECTED);
        unregisterCallback(instanceId, RTEvent.COLLABORATOR_DISCONNECTED);
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
