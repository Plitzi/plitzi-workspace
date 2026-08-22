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

/**
 * The flow's own entry used to read `completed` as soon as the traversal finished, whatever its steps did — so a
 * broken step showed up as a green badge with the failure buried in a separate entry.
 */
describe('the status a flow reports', () => {
  const logStatus = (call: unknown[] | undefined) => (call?.[2] as { status: string } | undefined)?.status;

  it('is failed when a step throws', async () => {
    const manager = new InteractionsManager('page1');
    const info = vi.spyOn(pConsole, 'info').mockImplementation(() => undefined);
    const danger = vi.spyOn(pConsole, 'danger').mockImplementation(() => undefined);

    manager.subscribe('el1', makeInteractions('el1', 'click', 'boom'), triggerDef, {
      boom: {
        action: 'boom',
        title: 'Boom',
        type: 'callback',
        callback: () => {
          throw new Error('boom');
        },
        params: {}
      }
    });

    await manager.interactionTrigger('el1', 'click', {});

    expect(logStatus(danger.mock.calls.at(-1))).toBe('failed');
    expect(info).not.toHaveBeenCalled();

    info.mockRestore();
    danger.mockRestore();
  });

  it('is failed when a step names a callback nothing registered', async () => {
    const manager = new InteractionsManager('page1');
    const info = vi.spyOn(pConsole, 'info').mockImplementation(() => undefined);
    const danger = vi.spyOn(pConsole, 'danger').mockImplementation(() => undefined);
    vi.spyOn(pConsole, 'warning').mockImplementation(() => undefined);

    manager.subscribe('el1', makeInteractions('el1', 'click', 'authLogin'), triggerDef, {
      login: { action: 'authLogin', title: 'Auth Login', type: 'callback', callback: vi.fn(), params: {} }
    });

    await manager.interactionTrigger('el1', 'click', {});

    expect(logStatus(danger.mock.calls.at(-1))).toBe('failed');
    expect(info).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('is completed when every step resolves', async () => {
    const manager = new InteractionsManager('page1');
    const info = vi.spyOn(pConsole, 'info').mockImplementation(() => undefined);
    const danger = vi.spyOn(pConsole, 'danger').mockImplementation(() => undefined);

    manager.subscribe('el1', makeInteractions('el1', 'click', 'login'), triggerDef, {
      login: { action: 'login', title: 'Auth Login', type: 'callback', callback: vi.fn(), params: {} }
    });

    await manager.interactionTrigger('el1', 'click', {});

    expect(logStatus(info.mock.calls.at(-1))).toBe('completed');
    expect(danger).not.toHaveBeenCalled();

    info.mockRestore();
    danger.mockRestore();
  });
});

/**
 * A step's params are not always strings, and the one that matters is `input` on a server action.
 *
 * Authored as a line of JSON text it resolves fine right up until a value contains a quotation mark or a newline
 * — a post body, in other words — and the interpolated result stops being a document. Written as an object it is
 * safe for any text at all, which is only true if the resolver goes in after the values.
 */
describe('a param that is not a string', () => {
  const withParams = (params: Record<string, unknown>): Record<string, ElementInteraction> => ({
    trig: {
      id: 'trig',
      title: 'Trigger',
      type: 'trigger',
      action: 'click',
      params: {},
      preview: {},
      elementId: 'el1',
      beforeNode: '',
      afterNode: 'cb',
      flowId: 'flow1',
      enabled: true
    },
    cb: {
      id: 'cb',
      title: 'Callback',
      type: 'callback',
      action: 'spy',
      params,
      preview: {},
      elementId: 'el1',
      beforeNode: 'trig',
      afterNode: '',
      flowId: 'flow1',
      enabled: true
    }
  });

  const runWith = async (params: Record<string, unknown>) => {
    const manager = new InteractionsManager('page1');
    // Typed by its signature and not by its body, so the assertions below can read what the step was handed.
    const spy = vi.fn<(context: Record<string, unknown>) => string>(() => 'ok');

    manager.subscribe('el1', withParams(params), triggerDef, {
      spy: { action: 'spy', title: 'Spy', type: 'callback', callback: spy, params: {} }
    });

    await manager.interactionTrigger('el1', 'click', { body: 'Line one\n"quoted"\nline three' });

    return spy;
  };

  it('resolves the tokens inside an object, not only the ones at the top', async () => {
    const spy = await runWith({ input: { body: '{{trig.body}}', fixed: 'no token here' } });

    // Quotation marks and newlines survive intact, which is the whole reason to author `input` this way.
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      input: { body: 'Line one\n"quoted"\nline three', fixed: 'no token here' }
    });
  });

  it('goes into arrays too', async () => {
    const spy = await runWith({ input: { list: ['{{trig.body}}'] } });

    const handed = spy.mock.calls[0]?.[0] as { input: { list: string[] } };

    expect(handed.input.list[0]).toContain('Line one');
  });
});
