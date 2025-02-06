// Packages
import { createContext } from 'react';

import EventBridge from './EventBridge';

export type EventBridgeContextValue<T = unknown> = { eventBridge?: EventBridge<T> };

const eventBridgeContextDefaultValue = {};

const EventBridgeContext = createContext<EventBridgeContextValue>(eventBridgeContextDefaultValue);

export default EventBridgeContext;
