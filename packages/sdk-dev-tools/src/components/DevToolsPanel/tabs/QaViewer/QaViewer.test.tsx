// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createElement, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import QaViewer from './QaViewer';
import { QaProvider } from '../../../../qa/QaContext';
import QaLayer from '../../../../qa/QaLayer';

import type { ElementDefinition } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

/** The page beside the panel, as the dev tools' container holds it, with the QA tab and its layer over it. */
const Harness = ({
  page,
  collapsed = false,
  store = {}
}: {
  page: ReactNode;
  collapsed?: boolean;
  store?: Record<string, unknown>;
}) => {
  const pageRef = useRef<HTMLDivElement>(null);

  return createElement(
    StoreProvider,
    { value: store },
    createElement('div', { ref: pageRef, 'data-testid': 'page' }, page),
    createElement(QaProvider, { pageRef, collapsed }, createElement(QaLayer), createElement(QaViewer))
  );
};

const page = () => screen.getByTestId('page');

const definition = (type: string, extra: Partial<ElementDefinition> = {}): ElementDefinition => ({
  rootId: 'home',
  label: type,
  type,
  styleSelectors: { base: '' },
  ...extra
});

/** An animation as the page's `getAnimations` hands one over: only what the tools touch. */
const animation = (animationName: string) => ({ animationName, playbackRate: 1, cancel: vi.fn(), play: vi.fn() });

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

    fireEvent.click(screen.getByRole('button', { name: 'X-ray' }));

    expect(page().hasAttribute('data-plitzi-qa-page')).toBe(true);
    expect(document.head.querySelector('style[data-plitzi-qa]')?.textContent).toContain('outline: 1px dashed');

    fireEvent.click(screen.getByRole('button', { name: 'Boxes only' }));

    expect(screen.getByRole('button', { name: 'Boxes only' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.head.querySelector('style[data-plitzi-qa]')?.textContent).not.toContain('data-plitzi-qa-xray');

    fireEvent.click(screen.getByRole('button', { name: 'X-ray' }));

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

  it('marks what the document wires to each element, counts it, and shows one kind alone', () => {
    const flat = {
      title: {
        id: 'title',
        attributes: {},
        definition: definition('heading', {
          bindings: { attributes: [{ id: 'b1', source: 'state', to: 'content' }] }
        })
      },
      cta: {
        id: 'cta',
        attributes: {},
        definition: definition('button', {
          interactions: {
            go: {
              id: 'go',
              title: 'Go',
              type: 'trigger',
              action: 'onClick',
              params: {},
              preview: {},
              elementId: 'cta',
              beforeNode: '',
              afterNode: '',
              flowId: 'f1',
              enabled: true
            }
          },
          motion: { enter: 'fade' }
        })
      },
      plain: { id: 'plain', attributes: {}, definition: definition('text') }
    };
    render(
      createElement(Harness, {
        store: { schema: { flat, components: {} } },
        page: createElement(
          'div',
          null,
          createElement('h1', { 'data-plitzi-el': 'title' }, 'Hi'),
          createElement('button', { 'data-plitzi-el': 'cta', type: 'button' }, 'Go'),
          createElement('p', { 'data-plitzi-el': 'plain' }, 'Words')
        )
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'X-ray' }));

    const marks = (id: string) => page().querySelector(`[data-plitzi-el="${id}"]`)?.getAttribute('data-plitzi-qa-xray');
    expect(marks('title')).toBe('data');
    expect(marks('cta')).toBe('flows motion');
    expect(marks('plain')).toBeNull();
    expect(screen.getByRole('button', { name: /Runs a flow/ }).textContent).toContain('1');

    fireEvent.click(screen.getByRole('button', { name: /Runs a flow/ }));
    const css = document.head.querySelector('style[data-plitzi-qa]')?.textContent ?? '';

    expect(css).toContain('[data-plitzi-qa-xray~="flows"]');
    expect(css).not.toContain('[data-plitzi-qa-xray~="data"]');

    fireEvent.click(screen.getByRole('button', { name: 'X-ray' }));

    expect(marks('cta')).toBeNull();
  });

  it('slows every animation down, and gives them their speed back', () => {
    render(createElement(Harness, { page: null }));
    const playing = animation('plitzi-motion-fade');
    page().getAnimations = () => [playing] as unknown as Animation[];

    fireEvent.click(screen.getByRole('button', { name: 'Slow' }));

    expect(playing.playbackRate).toBe(0.25);

    fireEvent.click(screen.getByRole('button', { name: 'Slow' }));

    expect(playing.playbackRate).toBe(1);
  });

  it('replays the declared motion, and nothing else that moves', () => {
    render(createElement(Harness, { page: null }));
    const arrival = animation('plitzi-motion-rise');
    const spinner = animation('spin');
    page().getAnimations = () => [arrival, spinner] as unknown as Animation[];

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));

    expect(arrival.cancel).toHaveBeenCalledTimes(1);
    expect(arrival.play).toHaveBeenCalledTimes(1);
    expect(spinner.play).not.toHaveBeenCalled();
  });
});
