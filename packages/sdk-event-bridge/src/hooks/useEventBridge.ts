import { use, useEffect } from 'react';

import EventBridgeContext from '../EventBridgeContext';

import type { EventBridgeCallback, EventBridgeParams } from '../EventBridge';

const useEventBridge = (
  module: string,
  callbacks: Record<string, EventBridgeCallback> = {},
  params: EventBridgeParams = {},
  context = EventBridgeContext
) => {
  const { eventBridge } = use(context);

  useEffect(() => {
    if (!eventBridge || !module) {
      return undefined;
    }

    Object.keys(callbacks).forEach(key => {
      if (typeof callbacks[key] === 'function') {
        eventBridge.on(module, key, callbacks[key], params);
      }
    });

    return () => {
      Object.keys(callbacks).forEach(key => {
        if (typeof callbacks[key] === 'function') {
          eventBridge.off(module, key, callbacks[key]);
        }
      });
    };
  }, [module, callbacks, eventBridge, params]);

  return eventBridge;
};

export default useEventBridge;
