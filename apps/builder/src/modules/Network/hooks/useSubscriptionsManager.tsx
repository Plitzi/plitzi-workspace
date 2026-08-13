import { useCallback, useMemo, useRef, useEffect } from 'react';

import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import { SpaceEventSubscription } from '@plitzi/sdk-shared/network/graphql/builder';
import { validateSpaceEvent } from '@plitzi/sdk-shared/network/spaceEvents';

import type { ApolloClient } from '@apollo/client/core';
import type { SpaceEventMap, SpaceEventName, TSpaceEventSubscription } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type UseSubscriptionsManagerProps = {
  onMessage?: (message: ReactNode, type?: 'info' | 'success' | 'warning' | 'error' | 'default') => void;
  client: ApolloClient;
  environment?: string;
  disabled?: boolean;
};

type SpaceEventHandler<T extends SpaceEventName> = (payload: SpaceEventMap[T]) => void;

/**
 * The registry holds handlers for every event side by side, so it can only be typed against the union of payloads —
 * a handler written for one event is not assignable to that, and the JSON that arrives is `unknown` until `event`
 * names it. Both casts live here, at the boundary, so `subscribe` and its callers stay exactly typed.
 */
type RegisteredHandler = SpaceEventHandler<SpaceEventName>;

/**
 * One websocket subscription for the whole space, fanned out here by event name. Every edit travels on the same
 * stream, so registering interest in one is a map entry rather than another subscription: the socket is opened once,
 * on the first registration, and closed when the last one goes.
 */
const useSubscriptionsManager = ({ onMessage, client, environment, disabled }: UseSubscriptionsManagerProps) => {
  const handlers = useRef(new Map<SpaceEventName, Set<RegisteredHandler>>());
  const stream = useRef<{ unsubscribe(): void } | undefined>(undefined);

  const dispatch = useCallback((result: ApolloClient.SubscribeResult<TSpaceEventSubscription>) => {
    const spaceEvent = result.data?.SpaceEvent;
    if (!spaceEvent?.event) {
      return;
    }

    const eventHandlers = handlers.current.get(spaceEvent.event);
    if (!eventHandlers) {
      return;
    }

    // The compiler agreed with the server only for the build each was compiled in; a session talking to a server of
    // another version is exactly where that stops being true, and the payload is JSON either way. Checking it here
    // turns a wrong shape into a named error instead of an `undefined` three calls deep in a reducer.
    const validation = validateSpaceEvent(spaceEvent.event, spaceEvent.data);
    if (!validation.ok) {
      pConsole.danger(
        'network',
        <span>
          Ignored <b>{spaceEvent.event}</b>: the payload is not what this event carries
        </span>,
        { event: spaceEvent.event, issues: validation.issues, payload: spaceEvent.data }
      );

      return;
    }

    for (const handler of eventHandlers) {
      handler(validation.data);
    }
  }, []);

  const openStream = useCallback(() => {
    if (stream.current) {
      return;
    }

    stream.current = client
      .subscribe<TSpaceEventSubscription>({ query: SpaceEventSubscription, variables: { environment } })
      .subscribe({
        next: dispatch,
        error: err => onMessage?.(`Subscription Error: ${err}`, 'error')
      });
  }, [client, environment, dispatch, onMessage]);

  const closeStream = useCallback(() => {
    stream.current?.unsubscribe();
    stream.current = undefined;
  }, []);

  /**
   * Drops listeners from one event or a list of them. `all` is what says how far it reaches: every callback on the
   * event, or only the one passed — which is how the function `subscribe` returns undoes just its own registration.
   * The socket goes with the last listener, whichever way it left.
   */
  const unsubscribe = useCallback(
    <T extends SpaceEventName>(event: T | T[], all = true, callback?: SpaceEventHandler<T>) => {
      const events = typeof event === 'string' ? [event] : event;
      events.forEach(eventName => {
        const eventHandlers = handlers.current.get(eventName);
        if (!eventHandlers) {
          return;
        }

        if (all || !callback) {
          eventHandlers.clear();
        } else {
          eventHandlers.delete(callback as RegisteredHandler);
        }

        if (eventHandlers.size === 0) {
          handlers.current.delete(eventName);
        }
      });

      if (handlers.current.size === 0) {
        closeStream();
      }
    },
    [closeStream]
  );

  /**
   * Returns the way to undo itself, for a caller that would rather not name the event twice. `all` reaches the other
   * listeners of that event too, the same flag `unsubscribe` takes.
   */
  const subscribe = useCallback(
    <T extends SpaceEventName>(event: T, callback: SpaceEventHandler<T>) => {
      if (disabled) {
        return () => undefined;
      }

      const eventHandlers = handlers.current.get(event) ?? new Set<RegisteredHandler>();
      eventHandlers.add(callback as RegisteredHandler);
      handlers.current.set(event, eventHandlers);
      openStream();

      return (all = false) => unsubscribe(event, all, callback);
    },
    [disabled, openStream, unsubscribe]
  );

  const stop = useCallback(() => {
    handlers.current.clear();
    closeStream();
  }, [closeStream]);

  // The environment travels in the stream's variables, so switching it has to reopen the socket. The handlers
  // registered against it are untouched: they are keyed by event, not by connection.
  const environmentOpened = useRef(environment);
  useEffect(() => {
    if (environmentOpened.current === environment) {
      return;
    }

    environmentOpened.current = environment;
    if (!stream.current) {
      return;
    }

    closeStream();
    openStream();
  }, [environment, closeStream, openStream]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const subscriptionsManagerMemo = useMemo(() => ({ subscribe, unsubscribe, stop }), [subscribe, unsubscribe, stop]);

  return subscriptionsManagerMemo;
};

export default useSubscriptionsManager;
