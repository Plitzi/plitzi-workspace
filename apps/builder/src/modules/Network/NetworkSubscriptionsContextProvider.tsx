import { useToast } from '@plitzi/plitzi-ui/Toast';
import omit from 'lodash-es/omit';
import set from 'lodash-es/set';
import { useCallback, use, useLayoutEffect, useMemo, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import useWebsocket from '@pmodules/Network/hooks/useWebsocket';

import { isRealTimeEvent, isRealTimeSelfEvent } from './helpers/EventTypes';

import type { RealTimeEvent, RealTimeMessage, RealTimeMessageCallback, SubscriptionCollaborator } from './types';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
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
  const [messageCallbacks, setMessageCallbacks] = useState<
    Record<RealTimeEvent, Record<string, RealTimeMessageCallback>>
  >({} as Record<RealTimeEvent, Record<string, RealTimeMessageCallback>>);
  const [collaborators, setCollaborators] = useState<SubscriptionCollaborator[]>([]);
  const { webKey, instanceId, server, userKey } = use(NetworkContext) as BuilderNetworkContextValue;

  const processMessage = useCallback(
    (e: MessageEvent) => {
      const { type, payload } = JSON.parse(e.data as string) as RealTimeMessage;
      if (payload && type === 'INIT') {
        // Init Realtime
        const collaborators = payload.collaborators.filter(collaborator => collaborator.instanceId !== instanceId);
        if (collaborators.length > 0) {
          setCollaborators(collaborators);
        }

        return;
      }

      if (!isRealTimeEvent(type)) {
        // Invalid Packet
        return;
      }

      if (
        !payload ||
        !(messageCallbacks[type] as Record<string, RealTimeMessageCallback> | undefined) ||
        payload.instanceId === instanceId
      ) {
        return;
      }

      Object.keys(messageCallbacks[type])
        .filter(callbackKey => callbackKey !== instanceId || isRealTimeSelfEvent(type))
        .forEach(callbackKey => messageCallbacks[type][callbackKey](payload));
    },
    [instanceId, messageCallbacks]
  );

  const { push } = useWebsocket({
    url: `${server.websocketServer}?instanceId=${instanceId}&token=${webKey}&userToken=${userKey}`,
    protocols: ['realtime-ws'],
    processMessage,
    connectMode: includeRealTime ? 'auto' : 'manual'
  });

  const registerCallback = useCallback((key: string, type: RealTimeEvent, callback: RealTimeMessageCallback) => {
    if (key) {
      setMessageCallbacks(state => set(state, `${type}.${key}`, callback));
    }
  }, []);

  const unregisterCallback = useCallback((key: string, type: RealTimeEvent) => {
    if (key) {
      setMessageCallbacks(
        state => omit(state, [`${type}.${key}`]) as Record<RealTimeEvent, Record<string, RealTimeMessageCallback>>
      );
    }
  }, []);

  useLayoutEffect(() => {
    if (includeSubscriptions) {
      registerCallback(instanceId, 'COLLABORATOR_CONNECTED', (payload: SubscriptionCollaborator) => {
        const {
          user: { firstName, surName }
        } = payload;
        addToast(
          <div>
            Collaborator <b>{`${firstName} ${surName}`}</b> Joined into the WorkSpace
          </div>,
          {
            appeareance: 'info',
            autoDismiss: true,
            placement: 'top-right'
          }
        );

        setCollaborators(state => [...state, payload]);
      });

      registerCallback(instanceId, 'COLLABORATOR_DISCONNECTED', (payload: SubscriptionCollaborator) => {
        const {
          user: { firstName, surName }
        } = payload;
        addToast(
          <div>
            Collaborator <b>{`${firstName} ${surName}`}</b> Left the WorkSpace
          </div>,
          {
            appeareance: 'info',
            autoDismiss: true,
            placement: 'top-right'
          }
        );

        setCollaborators(state => state.filter(item => item.instanceId !== payload.instanceId));
      });
    }

    return () => {
      if (includeSubscriptions) {
        unregisterCallback(instanceId, 'COLLABORATOR_CONNECTED');
        unregisterCallback(instanceId, 'COLLABORATOR_DISCONNECTED');
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
