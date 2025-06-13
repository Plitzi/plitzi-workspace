import { useCallback, useMemo, useRef, useEffect } from 'react';

import Subscriptions from '../Subscriptions';

import type { ApolloClient, FetchResult, NormalizedCacheObject, Observable } from '@apollo/client/core';
import type { DocumentNode } from 'graphql';

export type UseSubscriptionsManagerProps = {
  onMessage?: (message: string, type?: 'info' | 'success' | 'warning' | 'danger') => void;
  client?: ApolloClient<NormalizedCacheObject>;
  environment?: string;
  disabled?: boolean;
};

const useSubscriptionsManager = ({ onMessage, client, environment, disabled }: UseSubscriptionsManagerProps) => {
  const subscriptions = useRef<Observable<FetchResult<unknown>>[]>([]);

  const subscribe = useCallback(
    (
      subscriptionKey: keyof typeof Subscriptions,
      variables: Record<string, unknown>,
      callback: (result: FetchResult) => void
    ) => {
      if (!client || disabled) {
        return false;
      }

      if (!(Subscriptions[subscriptionKey] as DocumentNode | undefined)) {
        onMessage?.('Subscription not found', 'danger');

        return null;
      }

      const subscriptionObserver = client.subscribe({
        query: Subscriptions[subscriptionKey],
        variables: { ...variables, environment }
      });

      subscriptionObserver.subscribe(callback, err => onMessage?.(`Subscription Error: ${err}`, 'danger'));

      subscriptions.current.push(subscriptionObserver);

      return subscriptionObserver;
    },
    [client, onMessage, environment, disabled]
  );

  const stop = useCallback(() => {
    // stop all subscriptions
    subscriptions.current.forEach((/* subscription */) => {
      // subscription.unsubscribe();
      // console.log(subscription);
    });

    subscriptions.current = [];
  }, [subscriptions]);

  useEffect(() => {
    // reSync(client);

    return () => {
      stop();
    };
  }, [stop]);

  const subscriptionsManagerMemo = useMemo(() => ({ subscribe, stop }), [subscribe, stop]);

  return subscriptionsManagerMemo;
};

export default useSubscriptionsManager;
