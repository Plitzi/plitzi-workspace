import { createContext } from 'react';

import type { RTCallback, RTEvent, RTMessageManagedClient, SubscriptionCollaborator } from '@plitzi/sdk-shared';

export type BuilderSubscriptionsContextValue = {
  includeSubscriptions: boolean;
  supportRealTime: boolean;
  subscriptionsPush: (data: RTMessageManagedClient) => void;
  // `subscriberId` namespaces the slot: several listeners of the same event (one per collaborator) have to
  // coexist, and without it each registration replaced the previous one.
  subscriptionsRegisterCallback: (type: RTEvent, callback: RTCallback, subscriberId?: string) => void;
  subscriptionsUnregisterCallback: (type: RTEvent, subscriberId?: string) => void;
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
