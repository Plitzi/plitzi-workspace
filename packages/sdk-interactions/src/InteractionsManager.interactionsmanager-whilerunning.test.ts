import { describe, it, expect, vi } from 'vitest';

import InteractionsManager from './InteractionsManager';
import { makeInteractions, triggerDef } from './tests/InteractionsManager';

import type { ElementInteraction } from '@plitzi/sdk-shared';

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
 * A search as you type: only the last question is worth answering. A newer firing stops the run before it — the step
 * it waits on is told to stop, and nothing after that step runs.
 */
describe('InteractionsManager — whileRunning latest', () => {
  it('stops the run before it and runs the newest to the end', async () => {
    const manager = new InteractionsManager('page1');
    const interactions = makeInteractions('el1', 'click', 'wait');
    interactions.trig = { ...interactions.trig, whileRunning: 'latest' };
    interactions.cb = { ...interactions.cb, afterNode: 'done' };
    interactions.done = { ...interactions.cb, id: 'done', action: 'done', beforeNode: 'cb', afterNode: '' };
    const gates: (() => void)[] = [];
    const signals: (AbortSignal | undefined)[] = [];
    const done: number[] = [];
    manager.subscribe('el1', interactions, triggerDef, {
      wait: {
        action: 'wait',
        title: 'Wait',
        type: 'callback',
        params: {},
        callback: async (_params, context) => {
          signals.push(context?.signal);
          await new Promise<void>(resolve => gates.push(resolve));
        }
      },
      done: {
        action: 'done',
        title: 'Done',
        type: 'callback',
        params: {},
        callback: () => {
          done.push(signals.length);
        }
      }
    });
    const settle = async () => {
      for (let turn = 0; turn < 10; turn++) {
        await Promise.resolve();
      }
    };

    void manager.interactionTrigger('el1', 'click', {});
    await settle();
    void manager.interactionTrigger('el1', 'click', {});
    await settle();

    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted, 'the older run was not told to stop').toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    gates.forEach(open => open());
    await settle();

    expect(done, 'the superseded run went on to its next step').toEqual([2]);
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

  it('runs the flow of an element that re-rendered right after firing', async () => {
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
    // A form marks itself submitted as it fires: new callbacks, the same element.
    manager.update('plugin', firesOn('plugin'), { ...foundTrigger });
    await fired;

    expect(write).toHaveBeenCalledTimes(1);
  });

  it('does not update an element that is not subscribed', () => {
    const manager = new InteractionsManager('page1');

    expect(manager.update('plugin', firesOn('plugin'), foundTrigger)).toBe(false);
    expect(manager.subscriptors.plugin).toBeUndefined();
  });
});
/**
 * A step that does not wait is not waited on: consecutive synchronous steps run without giving the event loop a turn,
 * so the store changes they make are one change and React renders once — a flow of twenty `setState` steps used to
 * render the page twenty times. A step that returns a promise is still waited for, and the flow resumes after it.
 */
describe('a flow runs its synchronous steps without a turn between them', () => {
  const chain = (actions: string[]): Record<string, ElementInteraction> => {
    const ids = actions.map((_, index) => `s${index}`);

    return {
      trig: {
        id: 'trig',
        title: 'Trigger',
        type: 'trigger',
        action: 'click',
        params: {},
        preview: {},
        elementId: 'el1',
        beforeNode: '',
        afterNode: ids[0],
        flowId: 'flow1',
        enabled: true
      },
      ...Object.fromEntries(
        actions.map((action, index) => [
          ids[index],
          {
            id: ids[index],
            title: action,
            type: 'callback',
            action,
            params: {},
            preview: {},
            elementId: 'el1',
            beforeNode: index === 0 ? 'trig' : ids[index - 1],
            afterNode: ids[index + 1] ?? '',
            flowId: 'flow1',
            enabled: true
          } satisfies ElementInteraction
        ])
      )
    };
  };

  it('runs two synchronous steps before anything queued in between', async () => {
    const seen: string[] = [];
    const manager = new InteractionsManager('page1');
    manager.subscribe('el1', chain(['first', 'second']), triggerDef, {
      first: {
        action: 'first',
        title: 'First',
        type: 'callback',
        params: {},
        callback: () => {
          queueMicrotask(() => seen.push('a turn'));
          seen.push('first');
        }
      },
      second: { action: 'second', title: 'Second', type: 'callback', params: {}, callback: () => seen.push('second') }
    });

    await manager.interactionTrigger('el1', 'click', {});

    expect(seen).toEqual(['first', 'second', 'a turn']);
  });

  it('waits for a step that waits, and hands the next one what it answered', async () => {
    const manager = new InteractionsManager('page1');
    const read = vi.fn();
    manager.subscribe('el1', chain(['slow', 'after']), triggerDef, {
      slow: {
        action: 'slow',
        title: 'Slow',
        type: 'callback',
        params: {},
        callback: () => new Promise(resolve => setTimeout(() => resolve('late'), 5))
      },
      after: { action: 'after', title: 'After', type: 'callback', params: {}, callback: read }
    });

    await manager.interactionTrigger('el1', 'click', {});

    expect(read).toHaveBeenCalledWith(expect.objectContaining({ s0: 'late' }), expect.anything());
  });
});
/**
 * A list row or a component instance is a replica: its elements have the same ids as every other copy's. A step that
 * names one of them means the copy beside the element that fired it — "Details" opens this card's panel, not the last
 * card's.
 */
describe('InteractionsManager — a step naming an element every replica has', () => {
  const opensPanel = (buttonId: string): Record<string, ElementInteraction> => ({
    trig: { ...makeInteractions(buttonId, 'click', 'toggle').trig },
    cb: { ...makeInteractions(buttonId, 'click', 'toggle').cb, elementId: 'panel' }
  });

  const replica = (root: InteractionsManager) => {
    const manager = root.createChildManager();
    const toggle = vi.fn();
    manager.subscribe('button', opensPanel('button'), triggerDef);
    manager.subscribe(
      'panel',
      {},
      {},
      {
        toggle: { action: 'toggle', title: 'Toggle', type: 'callback', callback: toggle, params: {} }
      }
    );

    return { manager, toggle };
  };

  it('runs the callback of the copy the flow fired in', async () => {
    const root = new InteractionsManager('page1');
    const first = replica(root);
    const second = replica(root);

    await first.manager.interactionTrigger('button', 'click', {});

    expect(first.toggle).toHaveBeenCalledTimes(1);
    expect(second.toggle).not.toHaveBeenCalled();
  });

  it('still reaches an element of the page around the replica', async () => {
    const root = new InteractionsManager('page1');
    const pageToggle = vi.fn();
    root.subscribe(
      'banner',
      {},
      {},
      {
        toggle: { action: 'toggle', title: 'Toggle', type: 'callback', callback: pageToggle, params: {} }
      }
    );
    const manager = root.createChildManager();
    manager.subscribe(
      'button',
      {
        trig: { ...makeInteractions('button', 'click', 'toggle').trig },
        cb: { ...makeInteractions('button', 'click', 'toggle').cb, elementId: 'banner' }
      },
      triggerDef
    );

    await manager.interactionTrigger('button', 'click', {});

    expect(pageToggle).toHaveBeenCalledTimes(1);
  });
});
