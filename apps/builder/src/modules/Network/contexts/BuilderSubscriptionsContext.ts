import { createContext } from 'react';

import type { RTCallback, RTEvent, RTMessageManagedClient, SubscriptionCollaborator } from '@plitzi/sdk-shared';

export type BuilderSubscriptionsContextValue = {
  includeSubscriptions: boolean;
  supportRealTime: boolean;
  subscriptionsPush: (data: RTMessageManagedClient) => void;
  subscriptionsRegisterCallback: (key: string, type: RTEvent, callback: RTCallback) => void;
  subscriptionsUnregisterCallback: (key: string, type: RTEvent) => void;
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

const BuilderSubscriptionsContext = createContext<BuilderSubscriptionsContextValue>(
  builderSubscriptionsContextDefaultValue
);

export default BuilderSubscriptionsContext;
