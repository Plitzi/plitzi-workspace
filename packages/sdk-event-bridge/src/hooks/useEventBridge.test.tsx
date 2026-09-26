import { render } from '@testing-library/react';
import { useMemo } from 'react';
import { describe, expect, it, vi } from 'vitest';

import EventBridge from '../EventBridge';
import EventBridgeContext from '../EventBridgeContext';
import useEventBridge from './useEventBridge';

import type { EventBridgeCallback } from '../EventBridge';

const Subscriber = ({ callback, tick }: { callback: EventBridgeCallback; tick: number }) => {
  const callbacks = useMemo(() => ({ styleUpdate: callback }), [callback]);
  useEventBridge('element', callbacks);

  return <span>{tick}</span>;
};

/**
 * Every element on a page subscribes through this hook. A render that changes nothing it depends on must not take the
 * subscription off and put it back: the defaults it was given used to be new objects on every render, so it did — for
 * every element, on every render.
 */
describe('useEventBridge', () => {
  it('keeps its subscription across renders that change nothing it depends on', () => {
    const bridge = new EventBridge();
    const on = vi.spyOn(bridge, 'on');
    const off = vi.spyOn(bridge, 'off');
    const callback = vi.fn();
    const tree = (tick: number) => (
      <EventBridgeContext value={{ eventBridge: bridge }}>
        <Subscriber callback={callback} tick={tick} />
      </EventBridgeContext>
    );

    const { rerender } = render(tree(1));
    rerender(tree(2));
    rerender(tree(3));

    expect(on).toHaveBeenCalledTimes(1);
    expect(off).not.toHaveBeenCalled();
  });
});
