import { use, useEffect } from 'react';

import EventBridgeContext from '../EventBridgeContext';

import type { EventBridgeCallback, EventBridgeParams } from '../EventBridge';
import type EventBridge from '../EventBridge';
import type { EventBridgeEvent, EventBridgeModule } from '@plitzi/sdk-shared';

const useEventBridge = (
  module: EventBridgeModule,
  callbacks: Partial<Record<EventBridgeEvent, EventBridgeCallback>> = {},
  params: EventBridgeParams = {},
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
