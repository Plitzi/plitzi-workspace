import { useCallback, useMemo, useRef, useEffect } from 'react';

import Subscriptions from '../Subscriptions';

import type { ApolloClient, FetchResult, Observable } from '@apollo/client/core';
import type { DocumentNode } from 'graphql';
import type { ReactNode } from 'react';

export type UseSubscriptionsManagerProps = {
  onMessage?: (message: ReactNode, type?: 'info' | 'success' | 'warning' | 'error' | 'default') => void;
  client: ApolloClient<unknown>;
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

      subscriptionObserver.subscribe(callback, err => onMessage?.(`Subscription Error: ${err}`, 'error'));

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
