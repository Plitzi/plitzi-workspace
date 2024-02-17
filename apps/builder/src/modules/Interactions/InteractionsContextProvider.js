// Packages
import React, { useCallback, useContext, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import { produce } from 'immer';
import set from 'lodash/set';
import get from 'lodash/get';

// Monorepo
import useEventBridge from '@repo/event-bridge-shared/hooks/useEventBridge';
import { EventBridgeModuleTypes } from '@repo/event-bridge-shared/EventBridgeHelper';
import useInteractions from '@repo/interactions-shared/useInteractions';
import InteractionsContext from '@repo/interactions-shared/InteractionsContext';
import { flowTrigger } from '@repo/interactions-shared/InteractionsHelper';

// Alias
import NavigationContext from '@pmodules/Navigation/NavigationContext';

// Relatives
import PageInteractions from './sources/PageSource/PageInteractions';
import CollectionInteractions from './sources/CollectionSource/CollectionInteractions';

const InteractionsContextProvider = props => {
  const { children, previewMode = false } = props;
  const subscriptors = useRef({});
  const callbacksAvailables = useRef({});
  const { currentPageId, routeParams, queryParams } = useContext(NavigationContext);
  const eventBridge = useEventBridge(EventBridgeModuleTypes.INTERACTION, {});
  const interactionsDataRef = useRef({ currentPageId, ...routeParams, ...queryParams });
  interactionsDataRef.current = { currentPageId, ...routeParams, ...queryParams };
  const interactionsRunning = useRef({});

  const eventBridgeCallback = useCallback(
    interactions => async (subscriptorId, eventName, params) => {
      if (
        !interactions ||
        !eventName ||
        !subscriptorId ||
        get(interactionsRunning, `current.${subscriptorId}.${eventName}`)
      ) {
        return;
      }

      set(interactionsRunning, `current.${subscriptorId}.${eventName}`, true);

      const getAdditionalParams = get(subscriptors.current, `${subscriptorId}.getAdditionalParams`);
      let dataSource;
      if (typeof getAdditionalParams === 'function') {
        ({ dataSource } = getAdditionalParams() ?? {});
      }

      const triggersToRun = Object.values(interactions).filter(
        node => node.type === 'trigger' && node.action === eventName && node.enabled
      );

      await Promise.all(
        triggersToRun.map(trigger =>
          flowTrigger(
            trigger,
            interactions,
            callbacksAvailables.current,
            { [trigger.id]: params },
            { ...interactionsDataRef.current, ...dataSource, eventBridge }
          )
        )
      );

      set(interactionsRunning, `current.${subscriptorId}.${eventName}`, false);
    },
    [eventBridge]
  );

  const subscribe = useCallback(
    (id, interactions = {}, triggers = {}, callbacks = {}, getAdditionalParams = noop) => {
      subscriptors.current = produce(subscriptors.current, draft => {
        set(draft, id, { id, triggers, getAdditionalParams });
      });

      const callbackKeys = Object.keys(callbacks);
      if (callbackKeys.length > 0) {
        callbacksAvailables.current = produce(callbacksAvailables.current, draft => {
          draft[id] = callbackKeys.reduce((acum, callbackKey) => {
            const { title, callback, postCallback, params, preview, type } = callbacks[callbackKey];
            if (!callback || typeof callback !== 'function') {
              return acum;
            }

            return {
              ...acum,
              [callbackKey]: {
                title,
                callback,
                postCallback,
                action: callbackKey,
                elementId: id,
                params,
                preview,
                type
              }
            };
          }, {});
        });
      }

      if (interactions && triggers && Object.keys(triggers).length > 0) {
        eventBridge.on(EventBridgeModuleTypes.INTERACTION, id, eventBridgeCallback(interactions), { override: true });
      }
    },
    [eventBridge]
  );

  const unsubscribe = useCallback(
    id => {
      eventBridge.off(EventBridgeModuleTypes.INTERACTION, id);
      subscriptors.current = produce(subscriptors.current, draft => {
        delete draft[id];
      });

      callbacksAvailables.current = produce(callbacksAvailables.current, draft => {
        if (draft[id]) {
          delete draft[id];
        }
      });
    },
    [eventBridge]
  );

  const getSubscriptor = useCallback(subscriptorId => get(subscriptors.current, subscriptorId), []);

  const getCallbacksAvailables = useCallback(() => callbacksAvailables.current, []);

  const interactionTrigger = useCallback(
    (subscriptorId, eventName, params = {}) =>
      eventBridge.emit(EventBridgeModuleTypes.INTERACTION, subscriptorId, subscriptorId, eventName, params),
    [eventBridge]
  );

  const interactionsMemo = useMemo(
    () => ({ subscribe, unsubscribe, interactionTrigger, getSubscriptor, getCallbacksAvailables, useInteractions }),
    [subscribe, unsubscribe, interactionTrigger, getSubscriptor, getCallbacksAvailables, useInteractions]
  );

  return (
    <InteractionsContext.Provider value={interactionsMemo}>
      <CollectionInteractions>
        <PageInteractions previewMode={previewMode}>{children}</PageInteractions>
      </CollectionInteractions>
    </InteractionsContext.Provider>
  );
};

InteractionsContextProvider.propTypes = {
  children: PropTypes.node,
  previewMode: PropTypes.bool
};

export default InteractionsContextProvider;
