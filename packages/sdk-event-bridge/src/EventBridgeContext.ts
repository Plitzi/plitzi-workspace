import { createContext } from 'react';

import type EventBridge from './EventBridge';
import type { EventBridgeContextValue as EventBridgeContextValueShared } from '@plitzi/sdk-shared';

export type EventBridgeContextValue<T = unknown> = EventBridgeContextValueShared<InstanceType<typeof EventBridge<T>>>;

const eventBridgeContextDefaultValue = {} as EventBridgeContextValue;

const EventBridgeContext = createContext(eventBridgeContextDefaultValue);
EventBridgeContext.displayName = 'EventBridgeContext';

export default EventBridgeContext;
