import { createContext } from 'react';

import type { RTCallback, RTEvent, RTMessageManagedClient, SubscriptionCollaborator } from '@plitzi/sdk-shared';

export type BuilderSubscriptionsContextValue = {
  includeSubscriptions: boolean;
  supportRealTime: boolean;
  subscriptionsPush: (data: RTMessageManagedClient) => void;
  subscriptionsRegisterCallback: (type: RTEvent, callback: RTCallback) => void;
  subscriptionsUnregisterCallback: (type: RTEvent) => void;
  subscriptionsCollaborators: SubscriptionCollaborator[];
};

const builderSubscriptionsContextDefaultValue = {
  includeSubscriptions: true,
  supportRealTime: true,
  subscriptionsPush: () => {},
  subscriptionsRegisterCallback: () => {},
  subscriptionsUnregisterCallback: () => {},
  subscriptionsCollaborators: []
} as BuilderSubscriptionsContextValue;

const BuilderSubscriptionsContext = createContext(builderSubscriptionsContextDefaultValue);
BuilderSubscriptionsContext.displayName = 'BuilderSubscriptionsContext';

export default BuilderSubscriptionsContext;
