/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext } from 'react';

import type { RealTimeEvent, SubscriptionCollaborator } from '../types';

export type BuilderSubscriptionsContextValue = {
  includeSubscriptions: boolean;
  supportRealTime: boolean;
  subscriptionsPush: (data: { type: RealTimeEvent; payload: unknown }) => void;
  subscriptionsRegisterCallback: (key: string, type: RealTimeEvent, callback: (...args: any[]) => void) => void;
  subscriptionsUnregisterCallback: (key: string, type: RealTimeEvent) => void;
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
