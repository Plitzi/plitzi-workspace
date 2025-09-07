import { useEffect, useMemo } from 'react';

import EventBridge from './EventBridge';
import EventBridgeContext from './EventBridgeContext';

import type { ReactNode } from 'react';

export type EventBridgeContextProviderProps = {
  children?: ReactNode;
};

const EventBridgeContextProvider = ({ children }: EventBridgeContextProviderProps) => {
  const eventBridge = useMemo(() => new EventBridge(), []);

  useEffect(() => {
    return () => {
      eventBridge.clear();
    };
  }, [eventBridge]);

  const valueMemo = useMemo(() => ({ eventBridge }), [eventBridge]);

  return <EventBridgeContext value={valueMemo}>{children}</EventBridgeContext>;
};

export default EventBridgeContextProvider;
