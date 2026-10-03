import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useScrollToHash, { HASH_WAIT_MS } from './useScrollToHash';

const scrolled = vi.fn<(id: string) => void>();

const section = (id: string) => {
  const element = document.createElement('section');
  element.id = id;
  document.body.append(element);

  return element;
};

describe('useScrollToHash', () => {
  beforeEach(() => {
    // jsdom lays nothing out, so it has no scrolling to do: what matters is which element was asked to.
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled(this.id);
    };
    scrolled.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    vi.useRealTimers();
  });

  it('lands on the section a fragment names', () => {
    section('plans');
    renderHook(() => useScrollToHash({ hash: '#plans', enabled: true }));

    expect(scrolled).toHaveBeenCalledWith('plans');
  });

  it('waits for a section that renders once its data arrives', async () => {
    renderHook(() => useScrollToHash({ hash: '#plans', enabled: true }));
    expect(scrolled).not.toHaveBeenCalled();

    section('plans');
    await act(async () => {
      await Promise.resolve();
    });

    expect(scrolled).toHaveBeenCalledWith('plans');
  });

  it('leaves somebody who started scrolling on their own where they are', async () => {
    renderHook(() => useScrollToHash({ hash: '#plans', enabled: true }));
    window.dispatchEvent(new Event('wheel'));

    section('plans');
    await act(async () => {
      await Promise.resolve();
    });

    expect(scrolled).not.toHaveBeenCalled();
  });

  it('stops waiting after a while', async () => {
    renderHook(() => useScrollToHash({ hash: '#plans', enabled: true }));
    act(() => {
      vi.advanceTimersByTime(HASH_WAIT_MS + 1);
    });

    section('plans');
    await act(async () => {
      await Promise.resolve();
    });

    expect(scrolled).not.toHaveBeenCalled();
  });

  it('does nothing where navigation is not the visitor’s, nor without a fragment', () => {
    section('plans');
    renderHook(() => useScrollToHash({ hash: '#plans', enabled: false }));
    renderHook(() => useScrollToHash({ hash: '', enabled: true }));

    expect(scrolled).not.toHaveBeenCalled();
  });

  it('reads an escaped fragment, and one that does not decode as written', () => {
    section('café');
    section('100%');
    renderHook(() => useScrollToHash({ hash: '#caf%C3%A9', enabled: true }));
    renderHook(() => useScrollToHash({ hash: '#100%', enabled: true }));

    expect(scrolled.mock.calls.map(([id]) => id)).toEqual(['café', '100%']);
  });
});
