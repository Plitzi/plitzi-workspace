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
const Harness = ({ page }: { page: ReactNode }) => {
  const pageRef = useRef<HTMLDivElement>(null);

  return createElement(
    StoreProvider,
    { value: {} },
    createElement('div', { ref: pageRef, 'data-testid': 'page' }, page),
    createElement(QaProvider, { pageRef }, createElement(QaLayer), createElement(QaViewer))
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

    fireEvent.click(screen.getByRole('switch', { name: /Element outlines/ }));

    expect(page().hasAttribute('data-plitzi-qa-page')).toBe(true);
    expect(document.head.querySelector('style[data-plitzi-qa]')?.textContent).toContain('outline: 1px dashed');

    fireEvent.click(screen.getByRole('switch', { name: /Element outlines/ }));

    expect(page().hasAttribute('data-plitzi-qa-page')).toBe(false);
    expect(document.head.querySelector('style[data-plitzi-qa]')).toBeNull();
  });

  it('shows the page with less motion by the SDK’s own class', () => {
    render(createElement(Harness, { page: null }));

    fireEvent.click(screen.getByRole('switch', { name: /Reduced motion/ }));

    expect(document.documentElement.classList.contains('plitzi-reduced-motion')).toBe(true);

    fireEvent.click(screen.getByRole('switch', { name: /Reduced motion/ }));

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

    fireEvent.click(screen.getByRole('switch', { name: /Nameless controls/ }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(button.getAttribute('data-plitzi-qa-finding')).toBe('names');
    expect(screen.getByText('a button with no name')).toBeTruthy();

    fireEvent.click(screen.getByRole('switch', { name: /Nameless controls/ }));

    expect(button.hasAttribute('data-plitzi-qa-finding')).toBe(false);
  });
});
