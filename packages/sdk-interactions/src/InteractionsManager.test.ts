import { get } from '@plitzi/plitzi-ui/helpers';
import { describe, it, expect, vi } from 'vitest';

import InteractionsManager from './InteractionsManager';

import type { ElementInteraction, InteractionCallback } from '@plitzi/sdk-shared';

const makeInteractions = (
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

const triggerDef: Record<string, InteractionCallback> = {
  click: { action: 'click', title: 'Click', type: 'trigger', params: {} }
};

describe('InteractionsManager re-entrancy guard', () => {
  it('releases the running flag and keeps handling events after a node throws', async () => {
    const manager = new InteractionsManager('page1');
    const boom = vi.fn(() => {
      throw new Error('boom');
    });

    manager.subscribe('el1', makeInteractions('el1', 'click', 'boom'), triggerDef, {
      boom: { action: 'boom', title: 'Boom', type: 'callback', callback: boom, params: {} }
    });

    await manager.interactionTrigger('el1', 'click', {});
    await manager.interactionTrigger('el1', 'click', {});

    expect(boom).toHaveBeenCalledTimes(2);
    expect(get(manager.interactionsRunning, 'el1.click')).toBeFalsy();
  });

  it('keeps running healthy flows after a previous flow failed', async () => {
    const manager = new InteractionsManager('page1');
    const boom = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn(() => 'ok');

    manager.subscribe('el1', makeInteractions('el1', 'click', 'boom'), triggerDef, {
      boom: { action: 'boom', title: 'Boom', type: 'callback', callback: boom, params: {} }
    });
    manager.subscribe('el2', makeInteractions('el2', 'click', 'ok'), triggerDef, {
      ok: { action: 'ok', title: 'Ok', type: 'callback', callback: ok, params: {} }
    });

    await manager.interactionTrigger('el1', 'click', {});
    await manager.interactionTrigger('el2', 'click', {});

    expect(boom).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
