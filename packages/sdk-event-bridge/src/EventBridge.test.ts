import { describe, expect, it, vi } from 'vitest';

import EventBridge from './EventBridge';

import type { EventBridgeEvent } from '@plitzi/sdk-shared';

const element = 'element';
const main = 'main';
// Two events from the vocabulary; which two does not matter, only that they are different.
const EVENTS: Record<string, EventBridgeEvent> = {
  a_setState: 'styleUpdate',
  b_setState: 'styleAddFont',
  ready: 'builderSetSelected'
};
const event = (name: string): EventBridgeEvent => EVENTS[name];

describe('EventBridge', () => {
  it('delivers to what is subscribed, and stops when it is taken off', async () => {
    const bridge = new EventBridge();
    const heard = vi.fn();
    bridge.on(element, event('a_setState'), heard);
    await bridge.emit(element, event('a_setState'), 'x');
    bridge.off(element, event('a_setState'), heard);
    await bridge.emit(element, event('a_setState'), 'y');

    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledWith('x');
  });

  // The module goes when its LAST event does — counted, not found by walking every key it has left.
  it('forgets a module once its last event is taken off, and not before', () => {
    const bridge = new EventBridge();
    const first = vi.fn();
    const second = vi.fn();
    bridge.on(element, event('a_setState'), first);
    bridge.on(element, event('b_setState'), second);

    bridge.off(element, event('a_setState'), first);
    expect(bridge.getEvents(element)).toHaveProperty(event('b_setState'));

    bridge.off(element, event('b_setState'), second);
    expect(bridge.getEvents()).not.toHaveProperty('element');
  });

  it('keeps an event while another callback still listens to it', () => {
    const bridge = new EventBridge();
    const first = vi.fn();
    const second = vi.fn();
    bridge.on(element, event('a_setState'), first);
    bridge.on(element, event('a_setState'), second);
    bridge.off(element, event('a_setState'), first);

    expect(bridge.get(element, event('a_setState'))).toHaveLength(1);
  });

  it('counts again from nothing after a clear', () => {
    const bridge = new EventBridge();
    bridge.on(element, event('a_setState'), vi.fn());
    bridge.on(main, event('ready'), vi.fn());
    bridge.clear(element);
    bridge.clear();

    const again = vi.fn();
    bridge.on(element, event('a_setState'), again);
    bridge.off(element, event('a_setState'), again);

    expect(bridge.getEvents()).toEqual({});
  });

  it('counts the events it was built with', () => {
    const kept = vi.fn();
    const bridge = new EventBridge({
      events: {
        [element]: { [event('a_setState')]: [{ callback: kept }], [event('b_setState')]: [{ callback: kept }] }
      }
    });
    bridge.off(element, event('a_setState'), kept);

    expect(bridge.getEvents()).toHaveProperty('element');

    bridge.off(element, event('b_setState'), kept);

    expect(bridge.getEvents()).not.toHaveProperty('element');
  });
});
