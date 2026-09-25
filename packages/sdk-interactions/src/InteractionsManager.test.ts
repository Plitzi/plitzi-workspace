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
    await manager.interactionTrigger('el1', 'click', {});
    expect(boom).toHaveBeenCalledTimes(3);
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
  /**
   * A param is a template whatever it holds.
   *
   * Only a bare name used to be recognised, so a condition or a loop was handed on as its own text — and a flag
   * set that way stored the template, a non-empty string that every later check read as true.
   */
  it('runs a condition and a loop, not only a name', async () => {
    const spy = await runWith({
      // eslint-disable-next-line quotes -- a template quoting its own strings reads best in the other quotes
      flag: "{{ trig.body ? '1' : '' }}",
      loop: '{% for n in [1, 2] %}{{ n }}{% endfor %}'
    });

    // Typed the way a token is: a template that renders a number hands on the number.
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ flag: 1, loop: 12 });
  });

  // What a visitor typed is data: resolved once as the value of a token, it is not evaluated again.
  it('does not evaluate braces inside a value it resolved', async () => {
    const manager = new InteractionsManager('page1');
    const spy = vi.fn<(context: Record<string, unknown>) => string>(() => 'ok');
    manager.subscribe('el1', withParams({ echo: '{{trig.body}}' }), triggerDef, {
      spy: { action: 'spy', title: 'Spy', type: 'callback', callback: spy, params: {} }
    });

    await manager.interactionTrigger('el1', 'click', { body: 'see {% if x %}this{% endif %}' });

    expect(spy.mock.calls[0]?.[0]).toMatchObject({ echo: 'see {% if x %}this{% endif %}' });
  });
});

/**
 * A step sees the page as it is when it runs. The sources are read again before every step, so a condition after a
 * write reads the written value, and one after a wait reads whatever changed meanwhile — not the page as it was when
 * the trigger fired.
 */
describe('InteractionsManager — what a step reads', () => {
  const chain = (elementId: string, steps: Partial<ElementInteraction>[]): Record<string, ElementInteraction> => {
    const ids = ['trig', ...steps.map((_, index) => `s${index}`)];

    return Object.fromEntries(
      ids.map((id, index) => [
        id,
        {
          id,
          title: id,
          type: index === 0 ? 'trigger' : 'callback',
          action: index === 0 ? 'click' : '',
          params: {},
          preview: {},
          elementId,
          beforeNode: ids[index - 1] ?? '',
          afterNode: ids[index + 1] ?? '',
          flowId: 'flow1',
          enabled: true,
          ...(index === 0 ? {} : steps[index - 1])
        } satisfies ElementInteraction
      ])
    );
  };

  const onState = (open: boolean) => ({
    combinator: 'and' as const,
    rules: [{ field: 'state.open', operator: '=' as const, value: open }]
  });

  it('reads what an earlier step of the same flow wrote', async () => {
    const page = { state: { open: false } };
    const opened = vi.fn();
    const manager = new InteractionsManager('page1');
    manager.subscribe(
      'el1',
      chain('el1', [{ action: 'open' }, { action: 'opened', when: onState(true) }]),
      triggerDef,
      {
        open: {
          action: 'open',
          title: 'Open',
          type: 'callback',
          params: {},
          callback: () => (page.state = { open: true })
        },
        opened: { action: 'opened', title: 'Opened', type: 'callback', params: {}, callback: opened }
      },
      () => ({ dataSource: page })
    );

    await manager.interactionTrigger('el1', 'click', {});

    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('reads what changed outside the flow while it waited', async () => {
    const page = { state: { open: true } };
    const stillOpen = vi.fn();
    let release = (): void => undefined;
    const manager = new InteractionsManager('page1');
    manager.subscribe(
      'el1',
      chain('el1', [{ action: 'wait' }, { action: 'stillOpen', when: onState(true) }]),
      triggerDef,
      {
        wait: {
          action: 'wait',
          title: 'Wait',
          type: 'callback',
          params: {},
          callback: () => new Promise<void>(resolve => (release = resolve))
        },
        stillOpen: { action: 'stillOpen', title: 'Still open', type: 'callback', params: {}, callback: stillOpen }
      },
      () => ({ dataSource: page })
    );

    const running = manager.interactionTrigger('el1', 'click', {});
    await Promise.resolve();
    page.state = { open: false };
    release();
    await running;

    expect(stillOpen).not.toHaveBeenCalled();
  });

  it('resolves a param template against the page as the step runs', async () => {
    const page = { state: { count: 1 } };
    const received = vi.fn();
    const manager = new InteractionsManager('page1');
    manager.subscribe(
      'el1',
      chain('el1', [{ action: 'bump' }, { action: 'show', params: { value: '{{ state.count }}' } }]),
      triggerDef,
      {
        bump: {
          action: 'bump',
          title: 'Bump',
          type: 'callback',
          params: {},
          callback: () => (page.state = { count: 2 })
        },
        show: { action: 'show', title: 'Show', type: 'callback', params: {}, callback: received }
      },
      () => ({ dataSource: page })
    );

    await manager.interactionTrigger('el1', 'click', {});

    expect(received).toHaveBeenCalledWith(expect.objectContaining({ value: 2 }), expect.anything());
  });
});

/** One key press fires `onKey` once, with the shortcuts it matched; each flow on it runs only for its own. */
describe('InteractionsManager — keyboard shortcuts', () => {
  const keyFlow = (id: string, keys: string, action: string): Record<string, ElementInteraction> => ({
    [`${id}-t`]: {
      id: `${id}-t`,
      title: 'On Key',
      type: 'trigger',
      action: 'onKey',
      params: { keys },
      preview: {},
      elementId: 'el1',
      beforeNode: '',
      afterNode: `${id}-s`,
      flowId: `${id}-t`,
      enabled: true
    },
    [`${id}-s`]: {
      id: `${id}-s`,
      title: action,
      type: 'callback',
      action,
      params: {},
      preview: {},
      elementId: 'el1',
      beforeNode: `${id}-t`,
      afterNode: '',
      flowId: `${id}-t`,
      enabled: true
    }
  });

  const setup = () => {
    const zoom = vi.fn();
    const close = vi.fn();
    const manager = new InteractionsManager('page1');
    manager.subscribe(
      'el1',
      { ...keyFlow('a', 'plus, =', 'zoom'), ...keyFlow('b', 'escape', 'close') },
      { onKey: { action: 'onKey', title: 'On Key', type: 'trigger', params: {} } },
      {
        zoom: { action: 'zoom', title: 'Zoom', type: 'callback', params: {}, callback: zoom },
        close: { action: 'close', title: 'Close', type: 'callback', params: {}, callback: close }
      }
    );

    return { manager, zoom, close };
  };

  it('runs only the flows whose keys the press matched', async () => {
    const { manager, zoom, close } = setup();

    await manager.interactionTrigger('el1', 'onKey', { key: '+', shortcuts: ['plus, ='] });

    expect(zoom).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('runs every flow one press matched, in one go', async () => {
    const { manager, zoom, close } = setup();

    await manager.interactionTrigger('el1', 'onKey', { key: 'escape', shortcuts: ['plus, =', 'escape'] });

    expect(zoom).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

/**
 * A trigger firing while its flow still runs: ignored (`skip`, the default), run alongside (`parallel`), or run after
 * it (`queue`). Each firing here opens a step that waits until the test lets it finish.
 */
describe('InteractionsManager — whileRunning', () => {
  const setup = (whileRunning?: 'skip' | 'parallel' | 'queue') => {
    const started: number[] = [];
    const finished: number[] = [];
    const gates: (() => void)[] = [];
    const manager = new InteractionsManager('page1');
    const interactions = makeInteractions('el1', 'click', 'wait');
    interactions.trig = { ...interactions.trig, ...(whileRunning ? { whileRunning } : {}) };
    manager.subscribe('el1', interactions, triggerDef, {
      wait: {
        action: 'wait',
        title: 'Wait',
        type: 'callback',
        params: {},
        callback: async () => {
          const run = started.length + 1;
          started.push(run);
          await new Promise<void>(resolve => gates.push(resolve));
          finished.push(run);
        }
      }
    });
    const settle = async () => {
      for (let turn = 0; turn < 10; turn++) {
        await Promise.resolve();
      }
    };

    return { manager, started, finished, gates, settle };
  };

  it('skips a firing while the flow runs, by default', async () => {
    const { manager, started, gates, settle } = setup();
    void manager.interactionTrigger('el1', 'click', {});
    void manager.interactionTrigger('el1', 'click', {});
    await settle();

    expect(started).toEqual([1]);
    gates.forEach(open => open());
    await settle();
    void manager.interactionTrigger('el1', 'click', {});
    await settle();
    expect(started).toEqual([1, 2]);
  });

  it('runs every firing at once in parallel', async () => {
    const { manager, started, settle } = setup('parallel');
    void manager.interactionTrigger('el1', 'click', {});
    void manager.interactionTrigger('el1', 'click', {});
    void manager.interactionTrigger('el1', 'click', {});
    await settle();

    expect(started).toEqual([1, 2, 3]);
  });

  it('runs every firing one after another in a queue', async () => {
    const { manager, started, finished, gates, settle } = setup('queue');
    void manager.interactionTrigger('el1', 'click', {});
    void manager.interactionTrigger('el1', 'click', {});
    void manager.interactionTrigger('el1', 'click', {});
    await settle();
    expect(started).toEqual([1]);

    gates[0]();
    await settle();
    expect(finished).toEqual([1]);
    expect(started).toEqual([1, 2]);

    gates[1]();
    await settle();
    gates[2]();
    await settle();
    expect(finished).toEqual([1, 2, 3]);
  });
});

/**
 * A trigger fired while the page mounts: the sources a flow calls register AFTER the element that fired, in the same
 * commit. The flow starts once they have.
 */
describe('InteractionsManager — a trigger fired while the page mounts', () => {
  const firesOn = (elementId: string): Record<string, ElementInteraction> => ({
    trig: {
      id: 'trig',
      title: 'Found',
      type: 'trigger',
      action: 'found',
      params: {},
      preview: {},
      elementId,
      beforeNode: '',
      afterNode: 'write',
      flowId: 'trig',
      enabled: true
    },
    write: {
      id: 'write',
      title: 'Write',
      type: 'globalCallback',
      action: 'write',
      params: {},
      preview: {},
      elementId: 'store',
      beforeNode: 'trig',
      afterNode: '',
      flowId: 'trig',
      enabled: true
    }
  });
  const foundTrigger = { found: { action: 'found', title: 'Found', type: 'trigger' as const, params: {} } };

  it('runs the flow against a source that registered right after the trigger fired', async () => {
    const write = vi.fn();
    const manager = new InteractionsManager('page1');
    manager.subscribe('plugin', firesOn('plugin'), foundTrigger);

    const fired = manager.interactionTrigger('plugin', 'found', {});
    manager.subscribe(
      'store',
      {},
      {},
      {
        write: { action: 'write', title: 'Write', type: 'globalCallback', params: {}, callback: write }
      }
    );
    await fired;

    expect(write).toHaveBeenCalledTimes(1);
  });

  it('does not run the flow of an element gone before it started', async () => {
    const write = vi.fn();
    const manager = new InteractionsManager('page1');
    manager.subscribe(
      'store',
      {},
      {},
      {
        write: { action: 'write', title: 'Write', type: 'globalCallback', params: {}, callback: write }
      }
    );
    manager.subscribe('plugin', firesOn('plugin'), foundTrigger);

    const fired = manager.interactionTrigger('plugin', 'found', {});
    // Unmounted and mounted again in the same tick — React's development double mount.
    manager.unsubscribe('plugin');
    manager.subscribe('plugin', firesOn('plugin'), foundTrigger);
    await fired;

    expect(write).not.toHaveBeenCalled();
  });
});
