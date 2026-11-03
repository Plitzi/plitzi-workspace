import { describe, it, expect, vi, afterEach } from 'vitest';

import { pConsole } from '@plitzi/sdk-shared/devTools';

import InteractionsManager from './InteractionsManager';
import { makeInteractions, triggerDef } from './tests/InteractionsManager';

/**
 * A trigger fired at an element that has not wired its flows yet — a tap on a page that has hydrated, before its
 * effects ran: kept, and run once the element wires them; said when no element ever does.
 */
describe('InteractionsManager — a trigger before its element subscribed', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const settle = async () => {
    for (let turn = 0; turn < 10; turn++) {
      await Promise.resolve();
    }
  };

  const ran: string[] = [];
  const callbacks = {
    act: {
      action: 'act',
      title: 'Act',
      type: 'callback' as const,
      params: {},
      callback: () => {
        ran.push('act');
      }
    }
  };

  it('runs the flow once the element subscribes and wires it, as React does it: subscribe, then update', async () => {
    ran.length = 0;
    const manager = new InteractionsManager('page1');
    const answered = manager.interactionTrigger('el1', 'click', {});
    await settle();
    expect(ran).toEqual([]);

    manager.subscribe('el1');
    manager.update('el1', makeInteractions('el1', 'click', 'act'), triggerDef, callbacks);
    await settle();

    expect(ran).toEqual(['act']);
    await expect(answered).resolves.toBeInstanceOf(Array);
  });

  it('says so, and runs nothing, for an element that goes before it wires its flows, or never does', async () => {
    ran.length = 0;
    const warning = vi.spyOn(pConsole, 'warning').mockImplementation(() => undefined);
    const manager = new InteractionsManager('page1');

    const gone = manager.interactionTrigger('el1', 'click', {});
    manager.subscribe('el1');
    manager.unsubscribe('el1');
    await expect(gone).resolves.toEqual([]);

    vi.useFakeTimers();
    const late = manager.interactionTrigger('el2', 'click', {});
    vi.advanceTimersByTime(6000);
    manager.subscribe('el2');
    manager.update('el2', makeInteractions('el2', 'click', 'act'), triggerDef, callbacks);
    await expect(late).resolves.toEqual([]);

    expect(ran).toEqual([]);
    expect(warning).toHaveBeenCalledTimes(2);
  });
});
