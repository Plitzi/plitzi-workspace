import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useScrollInteractions from './useScrollInteractions';

import type { InteractionsManagerApi } from '@plitzi/sdk-shared';
import type { ElementInteraction, InteractionCallback } from '@plitzi/sdk-shared';

const onScroll: ElementInteraction = {
  id: 'scrolled',
  title: 'On Scroll',
  type: 'trigger',
  action: 'onScroll',
  params: {},
  preview: {},
  elementId: 'row',
  beforeNode: '',
  afterNode: '',
  flowId: 'scrolled',
  enabled: true
};

const fired = vi.fn<(id: string, action: string, payload: unknown) => Promise<void>>();
// The hook calls one method of the manager; the rest of it has nothing to do with scrolling.
const manager = { interactionTrigger: fired } as unknown as InteractionsManagerApi;

/** A row of cards 1000px wide in a 400px box: jsdom lays nothing out, so its sizes are set by hand. */
const rowOfCards = () => {
  const node = document.createElement('div');
  const moves = { scrollBy: vi.fn(), scrollTo: vi.fn(), scrollIntoView: vi.fn() };
  Object.defineProperties(node, {
    scrollWidth: { value: 1000 },
    clientWidth: { value: 400 },
    scrollHeight: { value: 100 },
    clientHeight: { value: 100 }
  });
  Object.assign(node, moves);

  return { node, ...moves };
};

/** A step run the way the interactions manager runs it: the callback the element registered under the action. */
const run = (callbacks: Record<string, InteractionCallback>, action: string, params: Record<string, unknown>): void => {
  const registered = callbacks[action].callback;
  if (!registered) {
    throw new Error(`nothing is registered for ${action}`);
  }

  void registered(params);
};

const mount = (node: HTMLElement, interactions: Record<string, ElementInteraction> = {}, previewMode = true) =>
  renderHook(() =>
    useScrollInteractions({
      id: 'row',
      label: 'Cards',
      nodeRef: { current: node },
      interactions,
      previewMode,
      interactionsManager: manager
    })
  );

describe('useScrollInteractions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fired.mockReset();
    fired.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves the box by a share of what it shows, or to an end', () => {
    const { node, scrollBy, scrollTo } = rowOfCards();
    const { result } = mount(node);

    run(result.current, 'scrollBy', { x: '80%' });
    run(result.current, 'scrollTo', { x: 'end', behavior: 'auto' });

    expect(scrollBy).toHaveBeenCalledWith({ left: 320, top: 0, behavior: 'smooth' });
    expect(scrollTo).toHaveBeenCalledWith({ left: 600, top: 0, behavior: 'auto' });
  });

  it('brings the element into view where it is asked to land', () => {
    const { node, scrollIntoView } = rowOfCards();
    const { result } = mount(node);

    run(result.current, 'scrollIntoView', { block: 'center' });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  });

  it('says where the box is once on mount, and then once a frame however many scroll events arrive', () => {
    const { node } = rowOfCards();
    mount(node, { scrolled: onScroll });

    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(fired).toHaveBeenLastCalledWith('row', 'onScroll', { x: 0, y: 0, atStart: true, atEnd: false });

    node.scrollLeft = 600;
    act(() => {
      node.dispatchEvent(new Event('scroll'));
      node.dispatchEvent(new Event('scroll'));
      vi.advanceTimersToNextFrame();
    });

    expect(fired).toHaveBeenCalledTimes(2);
    expect(fired).toHaveBeenLastCalledWith('row', 'onScroll', { x: 600, y: 0, atStart: false, atEnd: true });
  });

  it('listens to nothing outside preview, or with no flow on its scroll', () => {
    mount(rowOfCards().node, { scrolled: onScroll }, false);
    mount(rowOfCards().node);

    act(() => {
      vi.advanceTimersToNextFrame();
    });

    expect(fired).not.toHaveBeenCalled();
  });
});
