import { useCallback, useMemo, useRef, useEffect } from 'react';

import Subscriptions from '../Subscriptions';

import type { SubscriptionsMap } from './../Subscriptions';
import type { ApolloClient } from '@apollo/client/core';
import type { DocumentNode } from 'graphql';
import type { ReactNode } from 'react';

export type UseSubscriptionsManagerProps = {
  onMessage?: (message: ReactNode, type?: 'info' | 'success' | 'warning' | 'error' | 'default') => void;
  client: ApolloClient;
  environment?: string;
  disabled?: boolean;
};

type Subscription = { closed: boolean; unsubscribe(): void; name: keyof SubscriptionsMap };

const useSubscriptionsManager = ({ onMessage, client, environment, disabled }: UseSubscriptionsManagerProps) => {
  const subscriptions = useRef<Subscription[]>([]);

  const subscribe = useCallback(
    <T extends keyof SubscriptionsMap>(
      subscriptionKey: T,
      variables: Record<string, unknown>,
      callback: (result: ApolloClient.SubscribeResult<SubscriptionsMap[T]>) => void
    ) => {
      if (disabled) {
        return false;
      }

      if (!(Subscriptions[subscriptionKey] as DocumentNode | undefined)) {
        onMessage?.('Subscription not found', 'error');

        return null;
      }

      const subscriptionObserver = client.subscribe({
        query: Subscriptions[subscriptionKey],
        variables: { ...variables, environment }
      });

      const subscription = subscriptionObserver.subscribe({
        next: callback,
        error: err => onMessage?.(`Subscription Error: ${err}`, 'error')
      }) as unknown as Subscription;

      subscription.name = subscriptionKey;
      subscriptions.current.push(subscription);

      return subscriptionObserver;
    },
    [client, onMessage, environment, disabled]
  );

  const unsubscribe = useCallback((subscriptionKey: keyof SubscriptionsMap | (keyof SubscriptionsMap)[]) => {
    if (typeof subscriptionKey === 'string') {
      subscriptionKey = [subscriptionKey];
    }

    const subscriptionsToStop = subscriptions.current.filter(subscription =>
      subscriptionKey.includes(subscription.name)
    );

    subscriptionsToStop.forEach(subscription => {
      subscription.unsubscribe();
    });

    subscriptions.current = subscriptions.current.filter(subscription => !subscription.closed);
  }, []);

  const stop = useCallback(() => {
    subscriptions.current.forEach(subscription => {
      subscription.unsubscribe();
    });

    subscriptions.current = [];
  }, [subscriptions]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const subscriptionsManagerMemo = useMemo(
    () => ({ subscribe, unsubscribe, stop, subscriptions }),
    [subscribe, unsubscribe, stop, subscriptions]
  );

  return subscriptionsManagerMemo;
};

export default useSubscriptionsManager;
