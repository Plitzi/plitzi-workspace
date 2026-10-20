import type { ElementInteraction, InteractionCallback } from '@plitzi/sdk-shared';

export const makeInteractions = (
  elementId: string,
  event: string,
  callbackAction: string
): Record<string, ElementInteraction> => ({
  trig: {
    id: 'trig',
    title: 'Trigger',
    type: 'trigger',
    action: event,
    params: {},
    preview: {},
    elementId,
    beforeNode: '',
    afterNode: 'cb',
    flowId: 'flow1',
    enabled: true
  },
  cb: {
    id: 'cb',
    title: 'Callback',
    type: 'callback',
    action: callbackAction,
    params: {},
    preview: {},
    elementId,
    beforeNode: 'trig',
    afterNode: '',
    flowId: 'flow1',
    enabled: true
  }
});

export const triggerDef: Record<string, InteractionCallback> = {
  click: { action: 'click', title: 'Click', type: 'trigger', params: {} }
};
