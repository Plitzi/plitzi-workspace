import { useEffect, useMemo } from 'react';

import EventBridge from './EventBridge';
import EventBridgeContext from './EventBridgeContext';

import type { EventBridgeContextValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type EventBridgeContextProviderProps = {
  children?: ReactNode;
  debugMode: boolean;
  onInit?: (instance: EventBridgeContextValue) => void;
};

const EventBridgeContextProvider = ({ children, debugMode, onInit }: EventBridgeContextProviderProps) => {
  const eventBridge = useMemo(() => new EventBridge({ debugMode }), [debugMode]);

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
