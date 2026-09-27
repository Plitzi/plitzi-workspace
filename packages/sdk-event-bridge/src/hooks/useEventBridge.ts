import { use, useEffect } from 'react';

import EventBridgeContext from '../EventBridgeContext';

import type { EventBridgeCallback, EventBridgeParams } from '../EventBridge';
import type EventBridge from '../EventBridge';
import type { EventBridgeEvent, EventBridgeModule } from '@plitzi/sdk-shared';

/**
 * The defaults, made ONCE. They are the effect's dependencies: written as `= {}` in the signature they were a new
 * object on every render, so every caller that left them out — every element on the page, through `withElement` —
 * unsubscribed and subscribed again on every render it went through, whatever had changed.
 */
const NO_CALLBACKS: Partial<Record<EventBridgeEvent, EventBridgeCallback>> = Object.freeze({});
const NO_PARAMS: EventBridgeParams = Object.freeze({});

const useEventBridge = (
  module: EventBridgeModule,
  callbacks: Partial<Record<EventBridgeEvent, EventBridgeCallback>> = NO_CALLBACKS,
  params: EventBridgeParams = NO_PARAMS,
  context = EventBridgeContext,
  disabled: boolean = false
) => {
  const { eventBridge } = use(context);

  useEffect(() => {
    if (disabled || !(eventBridge as EventBridge | undefined) || !(module as string)) {
      return;
    }

    const entries = Object.entries(callbacks) as [EventBridgeEvent, EventBridgeCallback][];
    for (const [event, handler] of entries) {
      if (typeof handler === 'function') {
        eventBridge.on(module, event, handler, params);
      }
    }

    return () => {
      for (const [event, handler] of entries) {
        if (typeof handler === 'function') {
          eventBridge.off(module, event, handler);
        }
      }
    };
  }, [module, callbacks, eventBridge, params, disabled]);

  return eventBridge;
};

export default useEventBridge;
