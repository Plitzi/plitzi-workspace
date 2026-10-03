// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createElement, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import QaViewer from './QaViewer';
import { QaProvider } from '../../../../qa/QaContext';
import QaLayer from '../../../../qa/QaLayer';

import type { ReactNode } from 'react';

/** The page beside the panel, as the dev tools' container holds it, with the QA tab and its layer over it. */
const Harness = ({ page, collapsed = false }: { page: ReactNode; collapsed?: boolean }) => {
  const pageRef = useRef<HTMLDivElement>(null);

  return createElement(
    StoreProvider,
    { value: {} },
    createElement('div', { ref: pageRef, 'data-testid': 'page' }, page),
    createElement(QaProvider, { pageRef, collapsed }, createElement(QaLayer), createElement(QaViewer))
  );
};

const page = () => screen.getByTestId('page');

beforeEach(() => {
  // The page's box is watched for size: an observer that can be constructed, which the shared setup's is not.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('QaViewer', () => {
  it('marks the page only while a tool is on, and its rules go with it', () => {
    render(createElement(Harness, { page: createElement('p', null, 'Hello') }));

    expect(page().hasAttribute('data-plitzi-qa-page')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Outlines' }));

    expect(page().hasAttribute('data-plitzi-qa-page')).toBe(true);
    expect(document.head.querySelector('style[data-plitzi-qa]')?.textContent).toContain('outline: 1px dashed');

    fireEvent.click(screen.getByRole('button', { name: 'Outlines' }));

    expect(page().hasAttribute('data-plitzi-qa-page')).toBe(false);
    expect(document.head.querySelector('style[data-plitzi-qa]')).toBeNull();
  });

  it('shows the page with less motion by the SDK’s own class', () => {
    render(createElement(Harness, { page: null }));

    fireEvent.click(screen.getByRole('button', { name: 'Reduced motion' }));

    expect(document.documentElement.classList.contains('plitzi-reduced-motion')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Reduced motion' }));

    expect(document.documentElement.classList.contains('plitzi-reduced-motion')).toBe(false);
  });

  it('finds what has no name, marks it on the page and lists it', () => {
    vi.useFakeTimers();
    render(
      createElement(Harness, {
        page: createElement('button', { 'data-plitzi-el': 'close', type: 'button' }, createElement('i'))
      })
    );
    // jsdom draws nothing: the button is given a box to be found at all.
    const button = page().querySelector('button');
    if (!button) {
      throw new Error('no button on the page');
    }

    button.getClientRects = () => [new DOMRect(0, 0, 40, 40)] as unknown as DOMRectList;

    fireEvent.click(screen.getByRole('switch', { name: /No accessible name/ }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(button.getAttribute('data-plitzi-qa-finding')).toBe('names');
    expect(screen.getByText('a button with no name')).toBeTruthy();

    fireEvent.click(screen.getByRole('switch', { name: /No accessible name/ }));

    expect(button.hasAttribute('data-plitzi-qa-finding')).toBe(false);
  });

  it('keeps the element clicked while inspecting, without the page’s own click happening', () => {
    const pageClick = vi.fn();
    render(
      createElement(Harness, {
        page: createElement(
          'a',
          { href: '#away', 'data-plitzi-el': 'lp-hero-start', 'data-type': 'link', onClick: pageClick },
          'Start free'
        )
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }));
    fireEvent.click(screen.getByText('Start free'));

    expect(pageClick).not.toHaveBeenCalled();
    expect(screen.getByText('link · lp-hero-start')).toBeTruthy();
    expect(screen.getByText(/CSS that reaches it/)).toBeTruthy();
  });

  it('puts the inspector and the checks away when the panel is folded, and keeps the views', () => {
    const view = render(createElement(Harness, { page: createElement('p', null, 'Hello') }));

    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    fireEvent.click(screen.getByRole('switch', { name: /Low contrast/ }));
    view.rerender(createElement(Harness, { page: createElement('p', null, 'Hello'), collapsed: true }));

    expect(screen.getByRole('button', { name: 'Inspect' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('switch', { name: /Low contrast/ }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('button', { name: 'Grid' }).getAttribute('aria-pressed')).toBe('true');
  });
});
