// Packages
import { useCallback, useMemo, useRef, useEffect } from 'react';
import noop from 'lodash/noop';

// Alias
import Subscriptions from '@pmodules/Network/Subscriptions';

const useSubscriptionsManager = (props = {}) => {
  const { onMessage = noop, client, environment, disabled } = props;
  const subscriptions = useRef([]);

  const subscribe = useCallback(
    (subscriptionKey, documentKey, variables, callback) => {
      if (!client || disabled) {
        return false;
      }

      if (!Subscriptions[subscriptionKey]) {
        onMessage('Subscription not found', 'danger');

        return null;
      }

      const subscriptionObserver = client.subscribe({
        document: documentKey,
        query: Subscriptions[subscriptionKey],
        variables: { ...variables, environment }
      });

      subscriptionObserver.subscribe(callback, err => onMessage(`Subscription Error: ${err}`, 'danger'));

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
