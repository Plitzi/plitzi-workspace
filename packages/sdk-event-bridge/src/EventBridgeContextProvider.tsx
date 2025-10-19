import { useEffect, useMemo } from 'react';

import EventBridge from './EventBridge';
import EventBridgeContext from './EventBridgeContext';

import type { EventBridgeContextValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type EventBridgeContextProviderProps = {
  children?: ReactNode;
  onInit?: (instance: EventBridgeContextValue) => void;
};

const EventBridgeContextProvider = ({ children, onInit }: EventBridgeContextProviderProps) => {
  const eventBridge = useMemo(() => new EventBridge(), []);

  useEffect(() => {
    return () => {
      eventBridge.clear();
    };
  }, [eventBridge]);

  const valueMemo = useMemo(() => ({ eventBridge }), [eventBridge]);

  useEffect(() => {
    onInit?.(valueMemo);
  }, [onInit, valueMemo]);

  return <EventBridgeContext value={valueMemo}>{children}</EventBridgeContext>;
};

export default EventBridgeContextProvider;
