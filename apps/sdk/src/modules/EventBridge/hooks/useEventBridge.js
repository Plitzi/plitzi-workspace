// Packages
import { useContext, useEffect } from 'react';

// Relatives
import EventBridgeContext from '../EventBridgeContext';

export const MODE_WRITE = 'write';
export const MODE_READ = 'read';

const useEventBridge = (module, callbacks, params = {}, context = EventBridgeContext) => {
  const { eventBridge } = useContext(context);

  useEffect(() => {
    if (!eventBridge || !module || !callbacks) {
      return undefined;
    }

    Object.keys(callbacks)
      .filter(key => typeof callbacks[key] === 'function')
      .forEach(key => {
        eventBridge.on(module, key, callbacks[key], params);
      });

    return () => {
      Object.keys(callbacks)
        .filter(key => typeof callbacks[key] === 'function')
        .forEach(key => {
          eventBridge.off(module, key, callbacks[key]);
        });
    };
  }, [module, callbacks, eventBridge]);

  return eventBridge;
};

export default useEventBridge;
