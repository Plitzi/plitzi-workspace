import { describe, expect, it, vi } from 'vitest';

import { moveDrawn } from './viewTransition';

import type { TransitionHost } from './viewTransition';

describe('a move between pages, drawn', () => {
  const host = (reduced = false) => {
    const updates: (() => Promise<void>)[] = [];
    const page: TransitionHost = {
      startViewTransition: update => updates.push(update),
      prefersReducedMotion: () => reduced
    };

    return { page, updates };
  };

  it('is a view transition the space asked for, ended once the new page is drawn', async () => {
    const { page, updates } = host();
    const go = vi.fn();
    const drawn: { current: (() => void) | undefined } = { current: undefined };
    moveDrawn(go, { asked: true, host: page, drawn, waitMs: 60_000 });

    expect(go).not.toHaveBeenCalled();
    const ended = updates[0]();
    expect(go).toHaveBeenCalledOnce();
    drawn.current?.();
    await expect(ended).resolves.toBeUndefined();
  });

  it('is made at once when the space did not ask, the browser cannot, or the visitor wants less motion', () => {
    for (const [asked, page] of [
      [undefined, host().page],
      [true, { prefersReducedMotion: () => false }],
      [true, host(true).page]
    ] as const) {
      const go = vi.fn();
      moveDrawn(go, { asked, host: page, drawn: { current: undefined } });
      expect(go).toHaveBeenCalledOnce();
    }
  });
});
