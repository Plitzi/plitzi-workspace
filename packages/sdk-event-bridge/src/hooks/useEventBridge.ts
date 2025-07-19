import { use, useEffect } from 'react';

import EventBridgeContext from '../EventBridgeContext';

import type { EventBridgeCallback, EventBridgeParams } from '../EventBridge';
import type EventBridge from '../EventBridge';
import type { EventBridgeEvent, EventBridgeModule } from '@plitzi/sdk-shared';

const useEventBridge = (
  module: EventBridgeModule,
  callbacks: Partial<Record<EventBridgeEvent, EventBridgeCallback>> = {},
  params: EventBridgeParams = {},
  context = EventBridgeContext
) => {
  const { eventBridge } = use(context);

  useEffect(() => {
    if (!(eventBridge as EventBridge | undefined) || !(module as string)) {
      return undefined;
    }

    (Object.keys(callbacks) as EventBridgeEvent[]).forEach(key => {
      if (typeof callbacks[key] === 'function') {
        eventBridge.on(module, key, callbacks[key], params);
      }
    });

    return () => {
      (Object.keys(callbacks) as EventBridgeEvent[]).forEach(key => {
        if (typeof callbacks[key] === 'function') {
          eventBridge.off(module, key, callbacks[key]);
        }
      });
    };
  }, [module, callbacks, eventBridge, params]);

  return eventBridge;
};

export default useEventBridge;
