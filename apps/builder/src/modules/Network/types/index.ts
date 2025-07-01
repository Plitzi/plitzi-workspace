/* eslint-disable @typescript-eslint/no-explicit-any */
export type RealTimeEvent =
  | 'INIT'
  | 'KA'
  | 'MOUSE'
  | 'ELEMENT'
  | 'COLLABORATOR_CONNECTED'
  | 'COLLABORATOR_DISCONNECTED';

export type RealTimeSelfEvent = 'COLLABORATOR_CONNECTED' | 'COLLABORATOR_DISCONNECTED';

export type RealTimeMessage = {
  type: RealTimeEvent;
  payload?: { collaborators: SubscriptionCollaborator[]; instanceId: string };
  collaborators: SubscriptionCollaborator[];
};

export type SubscriptionCollaborator = {
  user: { firstName: string; surName: string };
  instanceId: string;
};

export type RealTimeMessageCallback = (...args: any[]) => void;
