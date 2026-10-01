import { sharedContext } from '@plitzi/sdk-shared/helpers/sharedContext';

import type EventBridge from './EventBridge';
import type { EventBridgeContextValue as EventBridgeContextValueShared } from '@plitzi/sdk-shared';

export type EventBridgeContextValue<T = unknown> = EventBridgeContextValueShared<InstanceType<typeof EventBridge<T>>>;

const eventBridgeContextDefaultValue = {} as EventBridgeContextValue;

const EventBridgeContext = sharedContext('EventBridgeContext', eventBridgeContextDefaultValue);

export default EventBridgeContext;
