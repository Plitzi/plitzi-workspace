import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useFullscreenInteractions from './useFullscreenInteractions';

/** A node in a document that keeps which element is on the whole screen, as a browser does. */
const onScreen = (enabled = true) => {
  const node = document.createElement('div');
  let shown: Element | null = null;
  // jsdom has no fullscreen: the two the step reads are given to this document for the test, and taken back after.
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => enabled });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => shown });
  node.requestFullscreen = vi.fn(() => {
    shown = node;

    return Promise.resolve();
  });
  document.exitFullscreen = vi.fn(() => {
    shown = null;

    return Promise.resolve();
  });
  const { result } = renderHook(() => useFullscreenInteractions({ label: 'Map', nodeRef: { current: node } }));
  const run = (mode?: string) => Promise.resolve(result.current.fullscreen.callback?.({ mode }));

  return { node, run, shown: () => shown };
};

describe('useFullscreenInteractions', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'fullscreenEnabled');
    Reflect.deleteProperty(document, 'fullscreenElement');
  });

  it('shows the element on the whole screen, and back when toggled again', async () => {
    const { node, run, shown } = onScreen();

    await run();
    expect(shown()).toBe(node);

    await run('toggle');
    expect(shown()).toBeNull();
  });

  it('enters and leaves one way only when told', async () => {
    const { node, run, shown } = onScreen();

    await run('exit');
    expect(shown()).toBeNull();

    await run('enter');
    await run('enter');
    expect(shown()).toBe(node);
  });

  it('fails where the browser does not allow it, for the flow to say so', async () => {
    const { run } = onScreen(false);

    await expect(run()).rejects.toThrow('Map cannot be shown on the whole screen here');
  });
});
