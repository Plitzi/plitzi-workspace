// Subscription Events
export const RealTimeEventTypes = {
  INIT: 'INIT',
  KA: 'KA',
  MOUSE: 'MOUSE',
  ELEMENT: 'ELEMENT',
  COLLABORATOR_CONNECTED: 'COLLABORATOR_CONNECTED',
  COLLABORATOR_DISCONNECTED: 'COLLABORATOR_DISCONNECTED'
};

export const RealTimeEventTypesList = Object.keys(RealTimeEventTypes);

export const RealTimeSelfEventTypesList = [
  RealTimeEventTypes.COLLABORATOR_CONNECTED,
  RealTimeEventTypes.COLLABORATOR_DISCONNECTED
];
