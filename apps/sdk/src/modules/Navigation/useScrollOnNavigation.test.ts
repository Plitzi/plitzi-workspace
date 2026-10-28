import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useScrollOnNavigation from './useScrollOnNavigation';

import type { NavigationAction } from './useScrollOnNavigation';

const scrolledTo = vi.fn<(y: number) => void>();

type At = { pathname: string; hash?: string; navigationKey: string; action: NavigationAction };

/** A navigation inside the site, as the router says it: the hook as the provider calls it. */
const navigate = () =>
  renderHook((at: At) => useScrollOnNavigation({ hash: '', ...at, enabled: true }), {
    initialProps: { pathname: '/r/bass-lab', navigationKey: 'a', action: 'POP' }
  });

/** Where the visitor scrolled to, as the page hears it. */
const scrollBy = (y: number) => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
};

// A room closed with navigate('/') opened Home at its foot, and Explore reached from a scrolled room opened past its
// title: a navigation inside the site left the document where the page before it was.
describe('useScrollOnNavigation', () => {
  beforeEach(() => {
    // jsdom lays nothing out: a page as tall as the scroll asked of it, and what was asked is what is held.
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 5000, configurable: true });
    Object.defineProperty(window, 'scrollTo', {
      value: (_x: number, y: number) => {
        scrolledTo(y);
      },
      configurable: true
    });
    scrolledTo.mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'scrollY');
  });

  it('leaves the page as it loaded where the browser put it', () => {
    navigate();

    expect(scrolledTo).not.toHaveBeenCalled();
  });

  it('opens another page at its top, and moves nothing when only the query changes', () => {
    const page = navigate();
    scrollBy(1800);

    page.rerender({ pathname: '/rooms', navigationKey: 'b', action: 'PUSH' });
    expect(scrolledTo).toHaveBeenLastCalledWith(0);

    scrolledTo.mockReset();
    page.rerender({ pathname: '/rooms', navigationKey: 'c', action: 'PUSH' });
    expect(scrolledTo).not.toHaveBeenCalled();
  });

  it('returns back and forward to where the visitor left each page', () => {
    const page = navigate();
    scrollBy(1800);
    page.rerender({ pathname: '/', navigationKey: 'b', action: 'PUSH' });
    scrollBy(300);

    page.rerender({ pathname: '/r/bass-lab', navigationKey: 'a', action: 'POP' });
    expect(scrolledTo).toHaveBeenLastCalledWith(1800);
    page.rerender({ pathname: '/', navigationKey: 'b', action: 'POP' });
    expect(scrolledTo).toHaveBeenLastCalledWith(300);
  });

  it('leaves a fragment to its own landing', () => {
    const page = navigate();
    page.rerender({ pathname: '/docs', hash: '#plans', navigationKey: 'b', action: 'PUSH' });

    expect(scrolledTo).not.toHaveBeenCalled();
  });

  it('waits for a page that is not tall enough yet to return to, unless the visitor moves first', async () => {
    const page = navigate();
    scrollBy(4200);
    page.rerender({ pathname: '/', navigationKey: 'b', action: 'PUSH' });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, configurable: true });
    page.rerender({ pathname: '/r/bass-lab', navigationKey: 'a', action: 'POP' });
    scrolledTo.mockReset();

    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 6000, configurable: true });
    await act(async () => {
      document.body.append(document.createElement('section'));
      await Promise.resolve();
    });

    expect(scrolledTo).toHaveBeenLastCalledWith(4200);
  });
});
