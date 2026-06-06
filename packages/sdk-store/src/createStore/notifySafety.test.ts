import { describe, it, expect, vi } from 'vitest';

import createStore from './createStore';

// Mutating the subscriber list from inside a notification used to corrupt the live array (swap-pop reorders it
// mid-iteration). These lock in the safe behaviour: removals tombstone + compact, additions wait for the next pass.

type State = { n: number };

describe('notify safety — mutating subscribers mid-notification', () => {
  it('does not skip a sibling when a listener unsubscribes itself', () => {
    const store = createStore<State>({ n: 0 });
    const order: string[] = [];

    const offA = store.subscribe(() => {
      order.push('a');
      offA();
    });
    store.subscribe(() => order.push('b'));
    store.subscribe(() => order.push('c'));

    store.setState('n', 1);

    // a runs once and removes itself; b and c are NOT skipped despite the mid-loop removal.
    expect(order).toEqual(['a', 'b', 'c']);

    order.length = 0;
    store.setState('n', 2);
    expect(order).toEqual(['b', 'c']); // a is gone for good
  });

  it('does not call a later sibling that an earlier listener unsubscribes mid-notify', () => {
    const store = createStore<State>({ n: 0 });
    const calls: string[] = [];

    let offC: () => void = () => {};
    store.subscribe(() => {
      calls.push('a');
      offC();
    });
    store.subscribe(() => calls.push('b'));
    offC = store.subscribe(() => calls.push('c'));

    store.setState('n', 1);

    expect(calls).toEqual(['a', 'b']); // c was removed before the loop reached it, no double, no crash
  });

  it('does not call a listener added during the same notification', () => {
    const store = createStore<State>({ n: 0 });
    const calls: string[] = [];

    store.subscribe(() => {
      calls.push('a');
      store.subscribe(() => calls.push('late'));
    });

    store.setState('n', 1);
    expect(calls).toEqual(['a']);

    store.setState('n', 2);
    expect(calls).toEqual(['a', 'a', 'late']); // the late listener joins from the next notification on
  });

  it('keeps path subscribers consistent when one unsubscribes during a wake', () => {
    const store = createStore<State>({ n: 0 });
    const calls: string[] = [];

    const offFirst = store.subscribePath('n', () => {
      calls.push('first');
      offFirst();
    });
    store.subscribePath('n', () => calls.push('second'));

    store.setState('n', 1);
    expect(calls).toEqual(['first', 'second']);

    calls.length = 0;
    store.setState('n', 2);
    expect(calls).toEqual(['second']);
  });

  it('survives a listener that throws without leaving the list in a notifying state', () => {
    const store = createStore<State>({ n: 0 });
    let bCalls = 0;
    store.subscribe(() => {
      throw new Error('listener blew up');
    });
    store.subscribe(() => bCalls++);

    // The throw propagates, but `end()` still runs (finally), so the next write is clean.
    expect(() => store.setState('n', 1)).toThrow('listener blew up');

    const off = store.subscribe(() => {});
    off(); // a normal swap-pop removal must still work afterwards
    expect(() => store.setState('n', 2)).toThrow();
  });

  it('runs every listener even when an earlier one throws, then re-raises the error', () => {
    const store = createStore<State>({ n: 0 });
    const order: string[] = [];

    store.subscribe(() => {
      order.push('a');
      throw new Error('a blew up');
    });
    store.subscribe(() => order.push('b'));

    // A throwing listener does not starve the next one, and the error still surfaces to the caller.
    expect(() => store.setState('n', 1)).toThrow('a blew up');
    expect(order).toEqual(['a', 'b']);
  });

  it('store.destroy() from inside a listener does not crash and tombstones the rest', () => {
    const store = createStore<State>({ n: 0 });

    let destroyRan = false;
    store.subscribe(() => {
      if (!destroyRan) {
        destroyRan = true;
        store.destroy?.();
      }
    });
    const afterDestroy = vi.fn();
    store.subscribe(afterDestroy);

    // clear() during notification tombstones the remaining slots instead of truncating the array the loop walks,
    // so the pass finishes cleanly and the torn-down listener never fires.
    expect(() => store.setState('n', 1)).not.toThrow();
    expect(afterDestroy).not.toHaveBeenCalled();
  });

  it('keeps the notify counter consistent after destroy() from inside a listener', () => {
    const store = createStore<State>({ n: 0 });

    let destroyRan = false;
    store.subscribe(() => {
      if (!destroyRan) {
        destroyRan = true;
        store.destroy?.();
      }
    });

    store.setState('n', 1);

    // Had clear() reset `notifying` mid-pass, end() would have driven it negative and later removals during a
    // notify would swap-pop instead of tombstone. A fresh subscribe + write must still fire exactly once.
    const reSub = vi.fn();
    const unsub = store.subscribe(reSub);

    store.setState('n', 2);

    expect(reSub).toHaveBeenCalledTimes(1);

    unsub();
  });
});
