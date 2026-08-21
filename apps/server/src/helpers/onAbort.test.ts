import { describe, expect, it, vi } from 'vitest';

import { onAbort } from './onAbort';

describe('onAbort', () => {
  it('calls back when the signal aborts', () => {
    const controller = new AbortController();
    const stop = vi.fn();
    onAbort(controller.signal, stop);

    controller.abort();

    expect(stop).toHaveBeenCalledTimes(1);
  });

  /** The reason this exists. `addEventListener` on a signal that already fired never calls back, so every listener
   *  attached after an `await` is a cancellation silently dropped. */
  it('calls back straight away for a signal that already aborted', () => {
    const controller = new AbortController();
    controller.abort();
    const stop = vi.fn();

    onAbort(controller.signal, stop);

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stops listening when released, so a long-lived signal collects no listeners', () => {
    const controller = new AbortController();
    const stop = vi.fn();

    onAbort(controller.signal, stop)();
    controller.abort();

    expect(stop).not.toHaveBeenCalled();
  });

  it('takes no signal at all', () => {
    expect(() => onAbort(undefined, vi.fn())()).not.toThrow();
  });
});
