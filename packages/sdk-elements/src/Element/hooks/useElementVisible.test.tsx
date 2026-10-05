import { act, renderHook, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import useElementVisible from './useElementVisible';

const root = document.createElement('div');

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({ utils: { rootRef: { current: root } } })
}));

/** jsdom draws nothing and has no `checkVisibility`: a node is drawn unless it, or something around it, is hidden. */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
    configurable: true,
    value(this: HTMLElement) {
      return !this.closest('.plitzi-component--hidden');
    }
  });
});

afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'checkVisibility');
});

afterEach(() => {
  root.innerHTML = '';
  root.remove();
});

describe('useElementVisible', () => {
  it('follows an element shown and hidden — by itself or by a container around it', async () => {
    document.body.append(root);
    root.innerHTML =
      '<div data-plitzi-el="panel"><div data-plitzi-el="tools" class="plitzi-component--hidden"></div></div>';
    const tools = root.querySelector('[data-plitzi-el="tools"]') as HTMLElement;
    const panel = root.querySelector('[data-plitzi-el="panel"]') as HTMLElement;

    const { result } = renderHook(() => useElementVisible('tools'));
    expect(result.current).toBe(false);

    act(() => tools.classList.remove('plitzi-component--hidden'));
    await waitFor(() => expect(result.current).toBe(true));

    act(() => panel.classList.add('plitzi-component--hidden'));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('is not on the page while nothing renders it', () => {
    document.body.append(root);

    const { result } = renderHook(() => useElementVisible('nowhere'));

    expect(result.current).toBe(false);
  });
});
