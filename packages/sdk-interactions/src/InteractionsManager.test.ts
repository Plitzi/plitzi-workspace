import { get } from '@plitzi/plitzi-ui/helpers';
import { describe, it, expect, vi } from 'vitest';

import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';

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

/**
 * A step naming a callback nothing registered used to fail in total silence: the control appeared to do nothing, and
 * there was no way to tell a mis-wired flow from a broken one. The name in a step is the key a callback was
 * REGISTERED under, which is not the label shown for it — an easy thing to get wrong and, until this, an invisible one.
 */
describe('a step wired to something that does not exist', () => {
  it('says so, naming what it looked for and what is actually there', async () => {
    const manager = new InteractionsManager('page1');
    const warning = vi.spyOn(pConsole, 'warning').mockImplementation(() => undefined);

    manager.subscribe('el1', makeInteractions('el1', 'click', 'authLogin'), triggerDef, {
      login: { action: 'authLogin', title: 'Auth Login', type: 'callback', callback: vi.fn(), params: {} }
    });

    await manager.interactionTrigger('el1', 'click', {});

    expect(warning).toHaveBeenCalledTimes(1);

    const [scope, , meta] = warning.mock.calls[0] as [string, unknown, { available: string[] }];

    expect(scope).toBe('interactions');
    expect(meta.available).toEqual(['login']);

    warning.mockRestore();
  });

  it('stays quiet when the step resolves', async () => {
    const manager = new InteractionsManager('page1');
    const warning = vi.spyOn(pConsole, 'warning').mockImplementation(() => undefined);
    const login = vi.fn();

    manager.subscribe('el1', makeInteractions('el1', 'click', 'login'), triggerDef, {
      login: { action: 'authLogin', title: 'Auth Login', type: 'callback', callback: login, params: {} }
    });

    await manager.interactionTrigger('el1', 'click', {});

    expect(login).toHaveBeenCalledTimes(1);
    expect(warning).not.toHaveBeenCalled();

    warning.mockRestore();
  });
});
